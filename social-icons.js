(function () {
  const types = [
    ['max', 'MAX', '#6D5DFB'],
    ['telegram', 'Telegram', '#229ED9'],
    ['whatsapp', 'WhatsApp', '#25D366'],
    ['phone', 'Телефон', '#F59E0B'],
    ['email', 'Почта', '#EA4335'],
    ['vk', 'VK', '#0077FF'],
    ['instagram', 'Instagram', '#E4405F'],
    ['youtube', 'YouTube', '#FF0033'],
    ['ok', 'Одноклассники', '#EE8208'],
    ['rutube', 'Rutube', '#00E7A9'],
    ['map', 'Карта', '#E87522'],
    ['web', 'Сайт', '#94A3B8'],
    ['custom', 'Другая ссылка', '#E87522']
  ].map(([value, label, color]) => ({value, label, color}));

  const icons = {
    max: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18V6.8c0-1 .8-1.8 1.8-1.8h1.4l4.8 6.1L16.8 5h1.4c1 0 1.8.8 1.8 1.8V18h-3.6v-7.1L12 16.2l-4.4-5.3V18H4Z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.5 3.5 3.7 10.4c-1.1.4-1.1 1.2-.2 1.5l4.6 1.4 1.7 5.3c.2.7.1 1 .8 1 .5 0 .7-.2 1-.5l2.2-2.1 4.5 3.3c.8.4 1.4.2 1.6-.8l3-14.3c.3-1.2-.5-1.7-1.4-1.2ZM9 13l9.3-6.1-7.7 7.3-.3 2.7L9 13Z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8a9 9 0 0 0-7.8 13.5L3 21.5l5.3-1.2A9 9 0 1 0 12 2.8Zm0 2a7 7 0 1 1-3.4 13.1l-.5-.3-2.5.6.6-2.4-.3-.5A7 7 0 0 1 12 4.8Zm-3.2 3c-.3 0-.7.1-.9.4-.4.4-1 1-1 2.3s1 2.6 1.1 2.8c.2.2 1.9 3 4.7 4 .7.3 1.2.4 1.6.5.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.7-.4l-2-.9c-.3-.1-.6-.2-.8.2l-.8 1c-.2.3-.4.3-.8.1a7.7 7.7 0 0 1-2.3-1.4 8.6 8.6 0 0 1-1.6-2c-.2-.3 0-.5.1-.7l.5-.6.3-.6c.1-.2.1-.5 0-.7l-.9-2.1c-.2-.5-.4-.5-.7-.5h-.7Z"/></svg>',
    phone: '<svg class="icon-stroke" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3 10 6 8.5 9.2c1 2.1 2.6 3.7 4.7 4.7l3.2-1.5 2.7 2.8c.5.5.5 1.2.1 1.8l-1.2 1.7c-.4.6-1.1.9-1.8.7C9.7 17.8 6.2 14.3 4.6 8c-.2-.7.1-1.4.7-1.8L7 3Z"/></svg>',
    email: '<svg class="icon-stroke" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
    vk: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.8 7.1h3.3c.2 3.2 1.5 5.4 3.6 5.9V7.1h3.1v3.4c2-.2 3.6-1.9 4.1-3.4H21c-.4 2-2.1 3.9-3.3 4.7 1.2.7 3.2 2.4 4 5.1h-3.5c-.6-1.7-2.2-3.1-4.4-3.3v3.3h-.4C7.6 16.9 4.3 13.5 3.8 7.1Z"/></svg>',
    instagram: '<svg class="icon-stroke" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" class="icon-fill"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.4 7.1a2.8 2.8 0 0 0-2-2C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.4.5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2.1 12a29 29 0 0 0 .5 4.9 2.8 2.8 0 0 0 2 2c1.7.5 7.4.5 7.4.5s5.7 0 7.4-.5a2.8 2.8 0 0 0 2-2 29 29 0 0 0 .5-4.9 29 29 0 0 0-.5-4.9ZM10 15.4V8.6l5.8 3.4-5.8 3.4Z"/></svg>',
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8a4.3 4.3 0 1 1 0 8.6 4.3 4.3 0 0 1 0-8.6Zm0 2.3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm5.3 7.2c.7.9.5 1.8-.4 2.4-.8.5-1.9 1-3 1.2l2.8 2.8c.7.7.7 1.7 0 2.3-.7.7-1.7.7-2.4 0L12 18.7 9.7 21c-.7.7-1.7.7-2.4 0-.7-.6-.7-1.6 0-2.3l2.8-2.8c-1.1-.2-2.2-.7-3-1.2-.9-.6-1.1-1.5-.4-2.4.6-.8 1.5-.7 2.3-.2 1.9 1.2 4.1 1.2 6 0 .8-.5 1.7-.6 2.3.2Z"/></svg>',
    rutube: '<svg class="icon-stroke" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h9.5a5 5 0 0 1 0 10H9v4H4V5Z"/><path d="m13 15 5 4M9 9h4.2a1 1 0 0 1 0 2H9V9Z"/></svg>',
    map: '<svg class="icon-stroke" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-6.6 6-12a6 6 0 1 0-12 0c0 5.4 6 12 6 12Z"/><circle cx="12" cy="9" r="2"/></svg>',
    web: '<svg class="icon-stroke" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.2 2.5 3.3 5.5 3.3 9S14.2 18.5 12 21M12 3C9.8 5.5 8.7 8.5 8.7 12s1.1 6.5 3.3 9"/></svg>',
    custom: '<svg class="icon-stroke" viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 14.5 5-5M7.2 16.8l-1 1a3.5 3.5 0 0 1-5-5l3.3-3.3a3.5 3.5 0 0 1 5 0M16.8 7.2l1-1a3.5 3.5 0 0 1 5 5l-3.3 3.3a3.5 3.5 0 0 1-5 0"/></svg>'
  };

  const colors = Object.fromEntries(types.map(item => [item.value, item.color]));
  const labels = Object.fromEntries(types.map(item => [item.value, item.label]));
  window.SitroSocialIcons = {
    types,
    colors,
    labels,
    render(type) { return icons[type] || icons.custom; }
  };
})();
