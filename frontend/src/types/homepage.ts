export type Language = 'en' | 'gu';

export interface StepCopy {
  title: string;
  description: string;
}

export interface HomepageCopy {
  skipToContent: string;
  nav: {
    home: string;
    howItWorks: string;
    services: string;
    join: string;
    status: string;
    language: string;
    openMenu: string;
    closeMenu: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    join: string;
    status: string;
    note: string;
    artLabel: string;
    artCaption: string;
  };
  steps: {
    eyebrow: string;
    title: string;
    description: string;
    items: StepCopy[];
  };
  services: {
    eyebrow: string;
    title: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
  };
  queue: {
    eyebrow: string;
    title: string;
    description: string;
    previewLabel: string;
    statusLabel: string;
    emptyTitle: string;
    emptyDescription: string;
    statusLink: string;
  };
  footer: {
    tagline: string;
    copyright: string;
  };
  placeholder: {
    eyebrow: string;
    description: string;
    back: string;
  };
}
