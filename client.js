// Proposed no-build client; not deployed. Host provides React.
window.__ModuleLoader__.load({
  id: 'dsh-browser-desktop',
  factory(require) {
    const React = require('react');
    const ID = 'browser-desktop';
    return {
      name: 'browser-desktop',
      inject: ['slots', 'layout'],
      apply(ctx) {
        ctx.slots.inject('main', () => ctx.slots.register(
          { name: 'main', key: ID },
          () => React.createElement('iframe', {
            title: '浏览器桌面', src: '/browser-desktop/view/',
            allow: 'clipboard-read; clipboard-write; fullscreen',
            style: { width: '100%', height: '100%', border: 0, display: 'block' },
          }),
        ));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
          { name: 'sidebar.panellist', id: ID, order: 50, label: '浏览器桌面' },
          ({ size = 16 } = {}) => React.createElement('span', {
            style: { fontSize: size, lineHeight: 1 }, 'aria-hidden': true,
          }, '▣'),
        ));
        ctx.effect(() => () => {
          if (ctx.layout.panelInfo.getSnapshot().activePanelId === ID) {
            ctx.layout.selectPanel(null);
          }
        }, 'browser-desktop: deselect on disposal');
      },
    };
  },
});
