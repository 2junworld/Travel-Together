import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLSelectElement",
  "Event",
  "MouseEvent",
])
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: dom.window[key],
  });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { default: React, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { ItemForm } = await import("../components/travel/TravelApp.tsx");
const { seed } = await import("../lib/travel/seed.ts");
const { createDraft } = await import("../lib/travel/create.ts");
async function render(item, bundle) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const saved = [];
  await act(async () =>
    root.render(
      React.createElement(ItemForm, {
        item,
        bundle,
        proposal: false,
        busy: false,
        onSave: async (x) => {
          saved.push(structuredClone(x));
        },
        onClose: () => {},
      }),
    ),
  );
  return {
    host,
    saved,
    cleanup: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}
async function fill(input, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      input instanceof dom.window.HTMLSelectElement
        ? dom.window.HTMLSelectElement.prototype
        : dom.window.HTMLInputElement.prototype,
      "value",
    ).set.call(input, value);
    input.dispatchEvent(
      new Event(
        input instanceof dom.window.HTMLSelectElement ? "change" : "input",
        { bubbles: true },
      ),
    );
  });
}
async function save(host) {
  await act(async () =>
    host
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
for (const kind of ["itinerary", "places", "checklist", "tasks"])
  test(`${kind}: only name entry saves, with closed options and persistent details`, async () => {
    const bundle = seed(),
      draft = createDraft(kind, bundle, "family", "2026-11-29");
    const { host, saved, cleanup } = await render(draft, bundle);
    const details = host.querySelector("details");
    assert.ok(details);
    assert.equal(details.open, false);
    const input = host.querySelector("input:not([type]),input[type=text]");
    assert.ok(input);
    assert.equal(document.activeElement === input, true);
    const mainInputs = [...host.querySelectorAll("input,textarea")].filter(
      (x) => !x.closest("details"),
    );
    assert.equal(mainInputs.length, ["itinerary", "checklist"].includes(kind) ? 2 : 1);
    assert.equal(
      host.querySelector("button[type=submit]").closest("details"),
      null,
    );
    assert.equal(
      host.querySelector(".quick-create-scope option:checked").textContent,
      "우리 가족에게 공개",
    );
    if (kind === "checklist") await fill(host.querySelector("input[list]"), " 백팩 ");
    await fill(input, kind === "itinerary" ? "호텔 체크인" : `${kind} 테스트`);
    await save(host);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].title, input.value);
    assert.equal(saved[0].data.type, null);
    assert.deepEqual(saved[0].data.assignees, []);
    assert.equal(saved[0].data.deadline, undefined);
    if (kind === "itinerary") {
      assert.equal(saved[0].data.date, "2026-11-29");
      assert.equal(saved[0].data.start, undefined);
    }
    if (kind === "checklist") {
      assert.equal(saved[0].data.quantity, 1);
      assert.equal(saved[0].data.bag, "백팩");
    }
    if (kind === "tasks") assert.equal(saved[0].data.status, "예정");
    // Native details retains mounted controls and React state across open/close cycles.
    details.open = true;
    const optional =
      kind === "checklist"
        ? host.querySelector("input[type=number]")
        : kind === "itinerary"
          ? host.querySelector("input[type=time]")
          : kind === "places"
            ? host.querySelector("details input")
            : host.querySelector("input[type=date]");
    const value =
      kind === "checklist"
        ? "3"
        : kind === "itinerary"
          ? "15:30"
          : kind === "places"
            ? "高雄"
            : "2026-11-28";
    await fill(optional, value);
    details.open = false;
    details.open = true;
    assert.equal(optional.value, value);
    details.open = false;
    await save(host);
    assert.equal(saved.length, 2);
    assert.equal(
      saved[1].data[
        kind === "checklist"
          ? "quantity"
          : kind === "itinerary"
            ? "start"
            : kind === "places"
              ? "address"
              : "deadline"
      ],
      kind === "checklist" ? 3 : value,
    );
    await fill(host.querySelector(".quick-create-scope select"), "personal");
    await save(host);
    assert.equal(saved.at(-1).scope, "personal");
    assert.equal(saved.at(-1).owner_id, bundle.userId);
    await cleanup();
  });
test("existing edits remain expanded and have no quick-add scope control", async () => {
  const bundle = seed();
  const { host, cleanup } = await render(bundle.items[0], bundle);
  assert.equal(host.querySelector("details"), null);
  assert.equal(host.querySelector(".quick-create-modal"), null);
  assert.equal(host.querySelector(".quick-create-scope"), null);
  assert.ok(host.querySelector("input[type=time]"));
  await cleanup();
});
test("normal participant still cannot select shared schedule/place creation", async () => {
  const bundle = seed();
  bundle.userId = bundle.members[1].user_id;
  for (const kind of ["itinerary", "places"]) {
    const { host, cleanup } = await render(
      createDraft(kind, bundle, "family", "2026-11-29"),
      bundle,
    );
    assert.equal(
      host.querySelector(".quick-create-scope option[value=trip]"),
      null,
    );
    await cleanup();
  }
});
