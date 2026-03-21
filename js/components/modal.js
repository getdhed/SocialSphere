export function createModalController(element) {
  const open = () => {
    element.classList.add("is-open");
    element.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  };

  const close = () => {
    element.classList.remove("is-open");
    element.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  };

  element.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeModal === "true") {
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && element.classList.contains("is-open")) {
      close();
    }
  });

  return { open, close };
}
