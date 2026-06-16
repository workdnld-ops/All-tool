// Native PWA-compatible screenshot implementation using only browser APIs
export async function html2canvas(element: HTMLElement, options: any = {}): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  // Get element dimensions
  const rect = element.getBoundingClientRect();
  const scale = options.scale || 2;

  canvas.width = rect.width * scale;
  canvas.height = rect.height * scale;
  ctx.scale(scale, scale);

  // PWA-compatible fallback rendering
  await renderListContent(element, ctx, rect);
  return canvas;
}

// PWA-safe manual rendering for list content
async function renderListContent(element: HTMLElement, ctx: CanvasRenderingContext2D, rect: DOMRect) {
  // Get the List component data from the element
  const listId = element.getAttribute('data-list-id');
  if (!listId) {
    throw new Error('List ID not found');
  }

  // Get list data from the element's dataset or reconstruct from DOM
  const titleElement = element.querySelector('[class*="font-semibold"]');
  const amountElement = element.querySelector('[class*="font-bold"]');

  const title = titleElement?.textContent || '記帳本';
  const totalAmount = amountElement?.textContent || '$0';

  // Dark theme background (matching your app)
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, rect.width, rect.height);

  // Render title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(title, 16, 40);

  // Render total amount
  ctx.fillStyle = '#eb9834';
  ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(totalAmount, 16, 80);

  // Render card count
  const cards = element.querySelectorAll('[class*="rounded-lg"], [class*="p-2"]');
  ctx.fillStyle = '#888888';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(`共 ${cards.length} 筆記錄`, 16, 110);

  // Render individual cards
  let yOffset = 140;
  cards.forEach((card, index) => {
    if (index >= 10) return; // Limit to 10 cards for readability

    const cardElement = card as HTMLElement;

    // Card background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(16, yOffset - 10, rect.width - 32, 60);

    // Card border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, yOffset - 10, rect.width - 32, 60);

    // Extract card content from DOM
    const textElements = cardElement.querySelectorAll('*');
    let contentText = '';
    let amountText = '';
    let dateText = '';

    textElements.forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.includes('$')) {
        amountText = text;
      } else if (text && /^\d{1,2}\/\d{1,2}$/.test(text)) {
        dateText = text;
      } else if (text && text.length > 0 && !text.includes('記帳本')) {
        contentText = text;
      }
    });

    // Render card content
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(contentText || `記錄 ${index + 1}`, 24, yOffset + 5);

    if (amountText) {
      ctx.fillStyle = '#eb9834';
      ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(amountText, 24, yOffset + 25);
    }

    if (dateText) {
      ctx.fillStyle = '#888888';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(dateText, rect.width - 60, yOffset + 5);
    }

    yOffset += 80;
  });
}

export default html2canvas;
