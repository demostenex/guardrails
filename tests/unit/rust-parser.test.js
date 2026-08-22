import assert from "node:assert/strict";
import test from "node:test";

import { parseFile } from "../../src/parser/generic-parser.js";

test("parseFile recognizes Rust functions, impl methods, structs and crate imports", () => {
  const lines = [
    "mod diagnostics;",
    "mod graphics;",
    "",
    "use std::error::Error;",
    "use crate::graphics::egl::EglContext;",
    "use crate::graphics::{egl, renderer};",
    "use x11rb::protocol::xproto::{self, Atom, Window};",
    "",
    "pub struct X11Connection {",
    "    screen_num: usize,",
    "}",
    "",
    "impl X11Connection {",
    "    pub fn connect() -> Result<Self, Box<dyn Error>> {",
    "        Ok(Self { screen_num: 0 })",
    "    }",
    "",
    "    pub fn screen_num(&self) -> usize { self.screen_num }",
    "}",
    "",
    "impl Drop for X11Connection {",
    "    fn drop(&mut self) {",
    "        self.screen_num = 0;",
    "    }",
    "}",
    "",
    "pub fn load<F>(loader: F)",
    "where",
    "    F: FnMut(&'static str) -> *const std::ffi::c_void,",
    "{",
    "    gl::load_with(loader);",
    "}",
    "",
    "fn main() -> Result<(), Box<dyn Error>> {",
    "    let connection = X11Connection::connect()?;",
    "    Ok(())",
    "}",
    ""
  ];

  const parsed = parseFile({
    path: "src/main.rs",
    content: lines.join("\n"),
    lines
  });

  assert.deepEqual(
    parsed.functions.map((fn) => fn.name),
    ["connect", "screen_num", "drop", "load", "main"]
  );
  assert.equal(parsed.functions.find((fn) => fn.name === "load").lineCount, 6);
  assert.equal(parsed.functions.find((fn) => fn.name === "connect").line, 14);

  const typeNames = parsed.classes.map((item) => item.name);
  assert.equal(typeNames.includes("X11Connection"), true);

  const implBlock = parsed.classes.find(
    (item) => item.name === "X11Connection" && item.methods.length > 0 && item.kind !== "struct"
  );
  assert.deepEqual(
    implBlock.methods.map((method) => method.name),
    ["connect", "screen_num"]
  );

  const dropImpl = parsed.classes.find((item) =>
    item.methods.some((method) => method.name === "drop")
  );
  assert.equal(dropImpl.name, "X11Connection");

  assert.deepEqual(
    parsed.imports.filter((item) => item.specifier === "diagnostics" || item.specifier === "graphics"),
    [
      { specifier: "diagnostics", resolvedPath: "src/diagnostics", line: 1 },
      { specifier: "graphics", resolvedPath: "src/graphics", line: 2 }
    ]
  );
  assert.deepEqual(
    parsed.imports.find((item) => item.specifier.includes("EglContext")),
    {
      specifier: "crate::graphics::egl::EglContext",
      resolvedPath: "src/graphics/egl",
      line: 5
    }
  );
  assert.equal(
    parsed.imports.some(
      (item) => item.specifier === "crate::graphics::egl" && item.resolvedPath === "src/graphics/egl"
    ),
    true
  );
  assert.equal(
    parsed.imports.some(
      (item) =>
        item.specifier === "crate::graphics::renderer" && item.resolvedPath === "src/graphics/renderer"
    ),
    true
  );
  assert.equal(
    parsed.imports.some((item) => item.specifier === "x11rb::protocol::xproto"),
    true
  );
});

test("parseFile resolves nested crate and super imports relative to the Rust module", () => {
  const lines = [
    "use crate::x11::connection::X11Connection;",
    "use super::renderer;",
    "use self::inner::Helper;",
    "",
    "pub fn render() {",
    "    let _ = 1;",
    "}",
    ""
  ];

  const parsed = parseFile({
    path: "crates/compositor/src/graphics/egl.rs",
    content: lines.join("\n"),
    lines
  });

  assert.deepEqual(parsed.imports, [
    {
      specifier: "crate::x11::connection::X11Connection",
      resolvedPath: "crates/compositor/src/x11/connection",
      line: 1
    },
    {
      specifier: "super::renderer",
      resolvedPath: "crates/compositor/src/graphics/renderer",
      line: 2
    },
    {
      specifier: "self::inner::Helper",
      resolvedPath: "crates/compositor/src/graphics/egl/inner",
      line: 3
    }
  ]);
});
