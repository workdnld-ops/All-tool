export function textareaHeight(contentHeight, viewportHeight) {
  return Math.min(Math.max(76, contentHeight), Math.max(76, viewportHeight - 100));
}

export function autoTextarea(field) {
  let frame;
  const resize = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!field.getClientRects().length) return;
      const scrollParent = field.closest('.modal');
      const previousScroll = scrollParent?.scrollTop;
      field.style.height = '0px';
      const contentHeight = field.scrollHeight + 2;
      const height = textareaHeight(contentHeight, window.visualViewport?.height ?? window.innerHeight);
      field.style.height = `${height}px`;
      field.style.overflowY = contentHeight > height ? 'auto' : 'hidden';
      if (scrollParent) scrollParent.scrollTop = previousScroll;
    });
  };
  field.addEventListener('input', resize);
  field.addEventListener('focus', resize);
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  return resize;
}
