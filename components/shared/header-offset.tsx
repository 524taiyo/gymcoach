'use client';

import { useEffect, useRef } from 'react';

// Publishes the rendered height of the app header as `--app-header-h` on the
// root element, so sticky bars below it (the session runner's progress strip)
// can sit exactly under the header on every viewport instead of relying on a
// hardcoded pixel offset. Renders nothing; place it inside the <header>.
export function HeaderOffset() {
  const probe = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const header = probe.current?.closest('header');
    if (!header) return;

    const root = document.documentElement;
    const publish = () => {
      root.style.setProperty('--app-header-h', `${header.getBoundingClientRect().height}px`);
    };
    publish();

    const observer = new ResizeObserver(publish);
    observer.observe(header);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--app-header-h');
    };
  }, []);

  return <span ref={probe} hidden aria-hidden="true" />;
}
