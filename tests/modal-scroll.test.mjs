import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "HTMLElement"])
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { default: React, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { Modal } = await import("../components/travel/TravelApp.tsx");

for (const initial of ["", "auto"])
  for (const firstClosed of ["detail", "edit", "both"])
    test(`overlapping detail/edit dialogs restore '${initial}' when closing ${firstClosed} first`, async () => {
      document.body.style.overflow = initial;
      const host = document.createElement("div");
      document.body.append(host);
      const root = createRoot(host);
      const show = async (detail, edit) => act(async () => root.render(
        React.createElement(React.StrictMode, null,
          detail && React.createElement(Modal, { key: "detail", title: "상세", onClose() {} }, React.createElement("button", null, "수정")),
          edit && React.createElement(Modal, { key: "edit", title: "수정", onClose() {} }, React.createElement("input")),
        ),
      ));
      try {
        await show(true, false);
        await show(true, true);
        assert.equal(document.body.style.overflow, "hidden");
        if (firstClosed !== "both") {
          await show(firstClosed !== "detail", firstClosed !== "edit");
          assert.equal(document.body.style.overflow, "hidden", "remaining dialog still locks background");
        }
        await show(false, false);
        assert.equal(document.body.style.overflow, initial, "saving or closing restores page scrolling");
        await show(true, true);
        await show(false, false);
        assert.equal(document.body.style.overflow, initial, "repeated edits also restore scrolling");
      } finally {
        await act(async () => root.unmount());
        host.remove();
      }
    });
