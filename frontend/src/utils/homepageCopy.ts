import type { HomepageCopy, Language } from '../types/homepage';

export const homepageCopy: Record<Language, HomepageCopy> = {
  en: {
    skipToContent: 'Skip to content',
    nav: {
      home: 'Home',
      howItWorks: 'How it works',
      services: 'Services',
      join: 'Join Queue',
      status: 'Check Queue Status',
      language: 'Language',
      openMenu: 'Open navigation menu',
      closeMenu: 'Close navigation menu',
    },
    hero: {
      eyebrow: 'A more considered salon visit',
      title: 'Your Style, Your Time.',
      description:
        'Spend less time waiting and more time feeling your best. Join the salon queue and keep track of your place before you arrive.',
      join: 'Join the Queue',
      status: 'Check Queue Status',
      note: 'A calmer way to make time for yourself.',
      artLabel: 'A quiet salon interior framed by an arched mirror',
      artCaption: 'Make room for a little more you.',
    },
    steps: {
      eyebrow: 'Simple by design',
      title: 'A better salon visit starts before you arrive.',
      description:
        'From joining the queue to sitting down for your service, your next visit stays easy to follow.',
      items: [
        {
          title: 'Join the Queue',
          description:
            'Join the salon queue when it suits you, without starting your visit in a waiting room.',
        },
        {
          title: 'Track Your Position',
          description:
            'Keep an eye on your place in the queue as your turn gets closer.',
        },
        {
          title: 'Get Your Service',
          description:
            'When it is your turn, settle in and enjoy the service you came for.',
        },
      ],
    },
    services: {
      eyebrow: 'The service menu',
      title: 'A little time, just for you.',
      description:
        'Explore the services available at the salon before choosing what is right for your visit.',
      emptyTitle: 'The service menu is being prepared.',
      emptyDescription:
        'Service details will appear here once the salon’s official service list is available.',
    },
    queue: {
      eyebrow: 'Queue preview',
      title: 'Your place, without the guesswork.',
      description:
        'A clear view of your queue status helps you know what to expect while you wait.',
      previewLabel: 'Live queue',
      statusLabel: 'Not connected',
      emptyTitle: 'No live queue information yet.',
      emptyDescription:
        'Live queue details will appear here when queue tracking is available. This preview is not connected to queue data yet.',
      statusLink: 'Check Queue Status',
    },
    footer: {
      tagline: 'A more thoughtful way to spend your time.',
      copyright: 'All rights reserved.',
    },
    placeholder: {
      eyebrow: 'Coming next',
      description:
        'This destination is not part of the homepage build yet. The queue flow will be added in a later step.',
      back: 'Back to Home',
    },
  },
  gu: {
    skipToContent: 'મુખ્ય સામગ્રી પર જાઓ',
    nav: {
      home: 'હોમ',
      howItWorks: 'કેવી રીતે કામ કરે છે',
      services: 'સેવાઓ',
      join: 'કતારમાં જોડાઓ',
      status: 'કતારની સ્થિતિ જુઓ',
      language: 'ભાષા',
      openMenu: 'નેવિગેશન મેનૂ ખોલો',
      closeMenu: 'નેવિગેશન મેનૂ બંધ કરો',
    },
    hero: {
      eyebrow: 'સલૂનની મુલાકાત હવે વધુ સરળ',
      title: 'તમારી સ્ટાઇલ, તમારો સમય.',
      description:
        'રાહ જોવામાં ઓછો સમય અને પોતાને શ્રેષ્ઠ અનુભવવામાં વધુ સમય. સલૂનની કતારમાં જોડાઓ અને આવતાં પહેલાં તમારો ક્રમ જુઓ.',
      join: 'કતારમાં જોડાઓ',
      status: 'કતારની સ્થિતિ જુઓ',
      note: 'તમારા માટે સમય કાઢવાની વધુ સરળ રીત.',
      artLabel: 'કમાનવાળા અરીસાથી સજાવેલું શાંત સલૂન',
      artCaption: 'તમારા માટે થોડો વધુ સમય.',
    },
    steps: {
      eyebrow: 'સરળ રીતે',
      title: 'સલૂનની સારી મુલાકાત આવતાં પહેલાં જ શરૂ થાય છે.',
      description:
        'કતારમાં જોડાવાથી લઈને તમારી સેવા શરૂ થાય ત્યાં સુધી, તમારી મુલાકાત સમજવામાં સરળ રહે છે.',
      items: [
        {
          title: 'કતારમાં જોડાઓ',
          description:
            'તમારી અનુકૂળતાએ સલૂનની કતારમાં જોડાઓ અને રાહ જોવાની જગ્યાએથી તમારી મુલાકાત શરૂ કરવાનું ટાળો.',
        },
        {
          title: 'તમારો ક્રમ જુઓ',
          description:
            'તમારો વારો નજીક આવે તેમ કતારમાં તમારો ક્રમ જાણતા રહો.',
        },
        {
          title: 'તમારી સેવા મેળવો',
          description:
            'તમારો વારો આવે ત્યારે આરામથી બેસો અને તમારી સેવા માણો.',
        },
      ],
    },
    services: {
      eyebrow: 'સેવા સૂચિ',
      title: 'તમારા માટે થોડો સમય.',
      description:
        'તમારી મુલાકાત માટે યોગ્ય સેવા પસંદ કરતાં પહેલાં સલૂનમાં ઉપલબ્ધ સેવાઓ જુઓ.',
      emptyTitle: 'સેવા સૂચિ તૈયાર થઈ રહી છે.',
      emptyDescription:
        'સલૂનની અધિકૃત સેવા સૂચિ ઉપલબ્ધ થયા પછી વિગતો અહીં દેખાશે.',
    },
    queue: {
      eyebrow: 'કતારની ઝલક',
      title: 'તમારો ક્રમ, સ્પષ્ટ રીતે.',
      description:
        'કતારની સ્થિતિ સ્પષ્ટ રીતે જોઈ શકવાથી રાહ જોતી વખતે શું અપેક્ષા રાખવી તે સમજાય છે.',
      previewLabel: 'લાઇવ કતાર',
      statusLabel: 'જોડાયેલ નથી',
      emptyTitle: 'હજુ લાઇવ કતારની માહિતી નથી.',
      emptyDescription:
        'કતાર ટ્રેકિંગ ઉપલબ્ધ થયા પછી વિગતો અહીં દેખાશે. આ ઝલક હજી કતારના ડેટા સાથે જોડાયેલી નથી.',
      statusLink: 'કતારની સ્થિતિ જુઓ',
    },
    footer: {
      tagline: 'તમારો સમય વધુ સમજદારીથી વાપરવાની રીત.',
      copyright: 'સર્વાધિકાર સુરક્ષિત.',
    },
    placeholder: {
      eyebrow: 'આગળ આવશે',
      description:
        'આ પાનું હાલના હોમપેજનો ભાગ નથી. કતારની પ્રક્રિયા પછીના તબક્કામાં ઉમેરાશે.',
      back: 'હોમ પર પાછા જાઓ',
    },
  },
};
