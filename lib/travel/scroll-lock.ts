// Multiple dialogs may overlap (for example, detail and edit). Each dialog
// releases only its own lock, regardless of the order React removes them.
const locks = new WeakMap<HTMLElement, { count: number; overflow: string }>();

export function lockBodyScroll(body: HTMLElement): () => void {
  let state = locks.get(body);
  if (!state) {
    state = { count: 0, overflow: body.style.overflow };
    locks.set(body, state);
  }
  state.count++;
  body.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--state.count === 0) {
      body.style.overflow = state.overflow;
      locks.delete(body);
    }
  };
}
