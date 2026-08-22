import assert from "node:assert/strict";
import test from "node:test";

import { analyzeDuplicates } from "../../src/analyzers/duplicate-analyzer.js";
import { parseFile } from "../../src/parser/generic-parser.js";

const config = {
  rules: {
    min_duplicate_body_chars: 40,
    min_similar_body_tokens: 20,
    similar_function_threshold: 0.85
  },
  policies: {
    duplicate_functions: "warn",
    similar_functions: "warn"
  }
};

test("analyzeDuplicates ignores Laravel migration up/down boilerplate", () => {
  const files = [
    phpFile(
      "database/migrations/2026_01_01_000001_add_status.php",
      [
        "class AddStatus",
        "{",
        "  public function up()",
        "  {",
        "    Schema::table('items', fn ($table) => $table->string('status'));",
        "  }",
        "",
        "  public function down()",
        "  {",
        "    Schema::table('items', fn ($table) => $table->dropColumn('status'));",
        "  }",
        "}"
      ].join("\n")
    ),
    phpFile(
      "database/migrations/2026_01_02_000001_add_type.php",
      [
        "class AddType",
        "{",
        "  public function up()",
        "  {",
        "    Schema::table('items', fn ($table) => $table->string('status'));",
        "  }",
        "",
        "  public function down()",
        "  {",
        "    Schema::table('items', fn ($table) => $table->dropColumn('status'));",
        "  }",
        "}"
      ].join("\n")
    )
  ].map(parseFile);

  assert.deepEqual(analyzeDuplicates(files, config), []);
});

test("analyzeDuplicates ignores simple Eloquent relationship methods", () => {
  const files = [
    phpFile(
      "app/Models/Documento.php",
      [
        "class Documento",
        "{",
        "  public function tenant()",
        "  {",
        "    return $this->belongsTo(Tenant::class);",
        "  }",
        "}"
      ].join("\n")
    ),
    phpFile(
      "app/Models/User.php",
      [
        "class User",
        "{",
        "  public function tenant()",
        "  {",
        "    return $this->belongsTo(Tenant::class);",
        "  }",
        "}"
      ].join("\n")
    )
  ].map(parseFile);

  assert.deepEqual(analyzeDuplicates(files, config), []);
});

test("analyzeDuplicates ignores tiny one-statement methods", () => {
  const files = [
    phpFile(
      "app/Livewire/One.php",
      [
        "class One",
        "{",
        "  public function updatedSearch()",
        "  {",
        "    $this->resetPage();",
        "  }",
        "}"
      ].join("\n")
    ),
    phpFile(
      "app/Livewire/Two.php",
      [
        "class Two",
        "{",
        "  public function updatedFilter()",
        "  {",
        "    $this->resetPage();",
        "  }",
        "}"
      ].join("\n")
    )
  ].map(parseFile);

  assert.deepEqual(analyzeDuplicates(files, config), []);
});

test("analyzeDuplicates ignores Breeze Volt logout scaffold actions", () => {
  const files = [
    phpFile(
      "resources/views/livewire/layout/navigation.blade.php",
      [
        "use App\\Livewire\\Actions\\Logout;",
        "use Livewire\\Volt\\Component;",
        "",
        "new class extends Component",
        "{",
        "  public function logout(Logout $logout): void",
        "  {",
        "    $logout();",
        "    $this->redirect('/', navigate: true);",
        "  }",
        "};"
      ].join("\n")
    ),
    phpFile(
      "resources/views/livewire/pages/auth/verify-email.blade.php",
      [
        "use App\\Livewire\\Actions\\Logout;",
        "use Livewire\\Volt\\Component;",
        "",
        "new class extends Component",
        "{",
        "  public function logout(Logout $logout): void",
        "  {",
        "    $logout();",
        "    $this->redirect('/', navigate: true);",
        "  }",
        "};"
      ].join("\n")
    )
  ].map(parseFile);

  assert.deepEqual(analyzeDuplicates(files, config), []);
});

test("analyzeDuplicates still reports duplicated delete protections", () => {
  const parsed = parseFile(
    phpFile(
      "app/Models/Concerns/NaoRemovivel.php",
      [
        "trait NaoRemovivel",
        "{",
        "  public function delete(): bool",
        "  {",
        "    throw new RegistroNaoRemovivelException(class_basename($this));",
        "  }",
        "",
        "  public function forceDelete(): bool",
        "  {",
        "    throw new RegistroNaoRemovivelException(class_basename($this));",
        "  }",
        "}"
      ].join("\n")
    )
  );

  const findings = analyzeDuplicates([parsed], config);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "duplicate_functions");
});

test("analyzeDuplicates still reports meaningful duplicated PHP logic", () => {
  const files = [
    phpFile(
      "app/Services/FirstService.php",
      [
        "class FirstService {",
        "  public function resolvePayload($items) {",
        "    $total = 0;",
        "    foreach ($items as $item) {",
        "      $total += $item->price * $item->quantity;",
        "    }",
        "    return ['total' => $total, 'count' => count($items)];",
        "  }",
        "}"
      ].join("\n")
    ),
    phpFile(
      "app/Services/SecondService.php",
      [
        "class SecondService {",
        "  public function buildPayload($items) {",
        "    $total = 0;",
        "    foreach ($items as $item) {",
        "      $total += $item->price * $item->quantity;",
        "    }",
        "    return ['total' => $total, 'count' => count($items)];",
        "  }",
        "}"
      ].join("\n")
    )
  ].map(parseFile);

  const findings = analyzeDuplicates(files, config);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "duplicate_functions");
});

test("analyzeDuplicates reports structurally similar function bodies", () => {
  const files = [
    phpFile(
      "app/Services/InvoiceService.php",
      [
        "class InvoiceService {",
        "  public function summarizeInvoices($invoices) {",
        "    $total = 0;",
        "    foreach ($invoices as $invoice) {",
        "      $total += $invoice->amount * $invoice->quantity;",
        "    }",
        "    return ['total' => $total, 'count' => count($invoices), 'kind' => 'invoice'];",
        "  }",
        "}"
      ].join("\n")
    ),
    phpFile(
      "app/Services/OrderService.php",
      [
        "class OrderService {",
        "  public function summarizeOrders($orders) {",
        "    $sum = 0;",
        "    $tax = 0;",
        "    foreach ($orders as $order) {",
        "      $sum += $order->price * $order->units;",
        "      $tax += $order->tax;",
        "    }",
        "    return ['total' => $sum + $tax, 'count' => count($orders), 'kind' => 'order'];",
        "  }",
        "}"
      ].join("\n")
    )
  ].map(parseFile);

  const findings = analyzeDuplicates(files, config);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "similar_functions");
  assert.equal(findings[0].details.functions.length, 2);
});

test("analyzeDuplicates does not report similar_functions for exact duplicates", () => {
  const files = [
    phpFile(
      "app/Services/FirstService.php",
      [
        "class FirstService {",
        "  public function resolvePayload($items) {",
        "    $total = 0;",
        "    foreach ($items as $item) {",
        "      $total += $item->price * $item->quantity;",
        "    }",
        "    return ['total' => $total, 'count' => count($items)];",
        "  }",
        "}"
      ].join("\n")
    ),
    phpFile(
      "app/Services/SecondService.php",
      [
        "class SecondService {",
        "  public function buildPayload($items) {",
        "    $total = 0;",
        "    foreach ($items as $item) {",
        "      $total += $item->price * $item->quantity;",
        "    }",
        "    return ['total' => $total, 'count' => count($items)];",
        "  }",
        "}"
      ].join("\n")
    )
  ].map(parseFile);

  const findings = analyzeDuplicates(files, config);

  assert.deepEqual(
    findings.map((finding) => finding.ruleId),
    ["duplicate_functions"]
  );
});

function phpFile(filePath, body) {
  const content = `<?php\n${body}\n`;

  return {
    path: filePath,
    content,
    lines: content.split(/\r?\n/)
  };
}
