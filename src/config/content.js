// Every fact on the site lives here, so the Dossier, the scenes and the search-engine text
// all say the same thing. Edit this file to update the portfolio.
export const PROFILE = {
  name: 'Nyende David',
  role: 'AI/ML Developer & Full-Stack Engineer',
  location: 'Kampala, Uganda · remote worldwide',
  available: 'Available for new projects',
  summary:
    'First Class Honours graduate in Artificial Intelligence and Machine Learning from ISBAT University (CGPA 4.51 / 5.00). I build end-to-end systems: from raw data and custom model training to cloud deployment and the screens people use.',
  about: [
    'My work sits where computer vision, predictive analytics and full-stack web development meet. I train models, wire them into real products and ship them.',
    'I care about applying AI to real challenges in East Africa: urban infrastructure, smallholder agriculture, and businesses that never had smart tools before.',
    'Outside code I care about clean design, clear documentation and making technical work easy to understand for people who are not engineers.',
  ],
  stats: [
    { value: '4.51', label: 'CGPA / 5.0' },
    { value: '90%', label: 'Model mAP' },
    { value: '40 FPS', label: 'CV speed' },
    { value: '8', label: 'Projects shown' },
  ],
};

export const CONTACT = {
  email: 'nyenzdav@gmail.com',
  phone: '+256 758 907 573',
  phoneHref: '+256758907573',
  github: 'https://github.com/nyenz',
  linkedin: '',   // add your LinkedIn link here
  x: '',          // add your X link here
  cv: '',         // add the path to your CV file here (e.g. 'cv/Nyende-David-CV.pdf' in /public)
};

export const EXPERIENCE = [
  { when: '2024 — now', title: 'AI/ML Developer & Freelance Web Developer', org: 'Independent · Kampala', text: 'Computer vision pipelines, ML-powered web apps and full-stack systems for clients, including a survey-company ERP and a distributor ordering app.' },
  { when: '2024', title: 'IoT Real-Time Traffic Monitoring System', org: 'Final-year research · ISBAT University', text: 'Custom YOLOv8 + ByteTrack trained on 5,000+ hand-annotated Ugandan road frames. 90% mAP at 40 FPS with live Firebase sync.' },
  { when: '2023', title: 'Cash-Crop Export Quantity Predictor', org: 'ML project · ISBAT University', text: 'Streamlit app predicting monthly exports for Uganda’s 7 major cash crops from 10 years of UCDA data. Random Forest reached 0.46 MAE.' },
  { when: '2020 — 2024', title: 'BSc. Artificial Intelligence & Machine Learning', org: 'ISBAT University · Kampala', text: 'First Class Honours, CGPA 4.51 / 5.00. ML, computer vision, algorithms, web development, databases and research methods.' },
];

export const PROJECTS = [
  { id: 'traffic', name: 'IoT Real-Time Traffic Monitoring', kind: 'Computer vision · IoT', year: '2024',
    line: 'Detects, classifies and tracks vehicles live on Ugandan roads.', tech: ['Python', 'YOLOv8', 'ByteTrack', 'OpenCV', 'Firebase'],
    result: '90% mAP at 40 FPS', links: [] },
  { id: 'erp', name: 'GE Solutions ERP', kind: 'Full-stack system', year: '2025–26',
    line: 'Runs a land-survey company: projects move through stages, staff roles, payments, audit trail and a printable project file.', tech: ['React', 'Java', 'Spring Boot', 'Docker', 'Render'],
    result: '200+ shipped improvements', links: [{ label: 'Code', href: 'https://github.com/nyenz/ge-solutions-erp' }] },
  { id: 'ugachick', name: 'Ugachick Distributor App', kind: 'Client app', year: '2026',
    line: 'Distributors order on their phones; orders sync with Business Central, with an audit record nobody can change.', tech: ['Java 21', 'Spring Boot 3', 'React', 'PostgreSQL'],
    result: 'Phone ordering for 12+ distributors', links: [] },
  { id: 'paper', name: 'Paper Cinema Studio', kind: 'Creative tool', year: '2026',
    line: 'A free app that makes narrated YouTube videos fully in code, timing every word with Whisper in the browser.', tech: ['JavaScript', 'Canvas / WebGL', 'Whisper'],
    result: 'Frame-perfect MP4 export', links: [{ label: 'Open app', href: 'https://nyenz.github.io/Automated-youtube-generator/' }, { label: 'Code', href: 'https://github.com/nyenz/Automated-youtube-generator' }] },
  { id: 'editforge', name: 'EditForge', kind: 'Desktop tool', year: '2026',
    line: 'A video editor on your own computer: simple typed lines become edits, beat cuts, captions and face follow.', tech: ['Python', 'FFmpeg'],
    result: 'Runs fully offline', links: [{ label: 'Code', href: 'https://github.com/nyenz/Video-editing-' }] },
  { id: 'cpu', name: 'CPU Showdown', kind: 'Data visualisation', year: '2026',
    line: 'Interactive comparison and benchmark explorer for Intel, AMD and Apple processors.', tech: ['React', 'TypeScript', 'Vite', 'Gemini'],
    result: 'Intel 8th gen → Apple M4', links: [] },
  { id: 'ges', name: 'GES Website', kind: 'Web development', year: '2025',
    line: 'Company website for Geomatic Engineering Solutions.', tech: ['Next.js', 'React', 'SCSS', 'Vercel'],
    result: 'Live company site', links: [] },
  { id: 'crops', name: 'Cash-Crop Export Predictor', kind: 'Machine learning · Agriculture', year: '2023',
    line: 'Predicts monthly export quantities for Uganda’s major cash crops.', tech: ['Python', 'scikit-learn', 'Streamlit', 'Pandas'],
    result: '0.46 MAE (Random Forest)', links: [] },
];

export const SKILLS = [
  { group: 'Computer vision & ML', items: ['YOLOv8', 'Object detection', 'ByteTrack', 'OpenCV', 'TensorFlow', 'PyTorch', 'scikit-learn', 'Predictive modelling'] },
  { group: 'Data', items: ['Python', 'Pandas', 'NumPy', 'Matplotlib', 'SQL', 'Jupyter'] },
  { group: 'Web & apps', items: ['React', 'Next.js', 'JavaScript', 'TypeScript', 'Three.js', 'Tailwind CSS', 'Node.js', 'REST APIs'] },
  { group: 'Backend & cloud', items: ['Java', 'Spring Boot', 'PostgreSQL', 'Docker', 'Firebase', 'Vercel', 'Streamlit'] },
];

export const TOOLS = ['VS Code', 'Jupyter', 'PyCharm', 'Git & GitHub', 'Google Colab', 'Roboflow', 'Ultralytics Hub', 'Streamlit Cloud', 'Figma', 'Canva', 'Postman', 'Notion', 'Firebase', 'Vercel', 'npm / pip', 'Windows / Linux'];

export const SERVICES = [
  'Computer vision and object detection systems',
  'Predictive analytics and ML modelling',
  'Full-stack web apps (React / Next.js / Spring Boot)',
  'Cloud integration: Firebase, Vercel, Docker',
  'IoT and real-time data pipelines',
  'ML research, reports and consulting',
  'UI / UX and graphic design',
];

// Presentation content: one entry per project (same ids as PROJECTS).
// flow = the "How it works" diagram, left to right.
export const DETAILS = {
  traffic: {
    style: 'grid',
    problem: 'Traffic data in Kampala is counted by hand, if at all. Planners need live numbers: how many vehicles, what kind, and how they move.',
    features: [
      ['Detects', 'Custom YOLOv8 model finds cars, boda-bodas, buses and trucks in every frame.'],
      ['Tracks', 'ByteTrack gives each vehicle an ID so it is counted once, even through crowds.'],
      ['Syncs live', 'Counts and classes stream to Firebase for a live dashboard.'],
    ],
    flow: ['Road camera', 'YOLOv8 detector', 'ByteTrack IDs', 'Counts + classes', 'Firebase', 'Live dashboard'],
    results: [['90%', 'mAP accuracy'], ['40 FPS', 'real-time speed'], ['5,000+', 'hand-labelled frames']],
  },
  erp: {
    style: 'stamp',
    problem: 'A land-survey company tracked every project, payment and title on paper and spreadsheets. Work got lost between stages and nobody could see the whole picture.',
    features: [
      ['Project stages', 'Each survey moves through clear stages, with the papers each stage needs checked on the server.'],
      ['Roles', 'Manager, secretary and staff each see and change only what their job needs.'],
      ['Audit + print', 'Every change is recorded, and a printable project file carries the company colours.'],
    ],
    flow: ['React app', 'Spring Boot API', 'JWT sign-in', 'PostgreSQL', 'Audit trail', 'Printed project file'],
    results: [['200+', 'improvements shipped'], ['3', 'staff roles'], ['Docker', 'one-command deploy']],
  },
  ugachick: {
    style: 'chain',
    problem: 'Distributors phoned in orders and nobody could see where an order was. Sales staff work in Business Central and could not change their tools.',
    features: [
      ['Order by phone', 'Distributors sign in with phone + PIN, order from the live item list and reorder in one tap.'],
      ['Follow every step', 'Placed, sales order, packed, actioned, received — with queries and photos until confirmed.'],
      ['Audit nobody can change', 'Management sees both sides of every order in an add-only ledger.'],
    ],
    flow: ['Distributor phone', 'React app', 'Spring Boot 3', 'PostgreSQL ledger', 'Business Central', 'Management view'],
    results: [['0', 'paid add-ons or SMS'], ['5', 'tracked order steps'], ['Java 21', 'modern backend']],
  },
  paper: {
    style: 'paper',
    problem: 'Making narrated YouTube videos takes editing skills and paid tools. Creators wanted a free way to go from an idea to a finished video.',
    features: [
      ['Three looks', 'Facet, low-poly paper or dark paper cinema — every visual is drawn in code.'],
      ['Word timing', 'Whisper runs in the browser and finds when every word is spoken.'],
      ['Frame-perfect export', 'Shorts and long videos export as MP4 with narration, sound and captions.'],
    ],
    flow: ['Topic + script', 'AI voice', 'Whisper timing', 'Shot plan', 'Code-built scenes', 'MP4 export'],
    results: [['$0', 'to run'], ['1080p', 'vertical + wide'], ['11', 'guided steps']],
  },
  editforge: {
    style: 'film',
    problem: 'Simple video edits need heavy software. Many people just want to cut, speed up and caption a clip without learning an editor.',
    features: [
      ['Type to edit', 'Lines like “keep 0:10-0:40” or “speed 2 from 15 to 20” become edits.'],
      ['Cut on the beat', 'A beat detector slices the video in time with the music.'],
      ['Follow + captions', 'Face and object follow, on-screen words and captions.'],
    ],
    flow: ['Your video', 'Clip workshop', 'Edit lines', 'Parser', 'FFmpeg pipeline', 'Finished clips'],
    results: [['100%', 'offline'], ['0', 'accounts or tracking'], ['v1.0', 'released']],
  },
  cpu: {
    style: 'heat',
    problem: 'CPU names and spec sheets are confusing. Buyers struggle to compare Intel, AMD and Apple chips for what they actually do.',
    features: [
      ['Compare', 'Pick chips side by side across generations from Intel 8th gen to Apple M4.'],
      ['See it', 'Radar, thermal and performance-per-watt charts make differences obvious.'],
      ['Explain', 'A guide powered by Gemini explains the trade-offs in plain words.'],
    ],
    flow: ['CPU dataset', 'React + TypeScript', 'Charts', 'Use-case scoring', 'Gemini guide', 'Your pick'],
    results: [['3', 'chip makers'], ['8+', 'generations'], ['Vite', 'fast build']],
  },
  ges: {
    style: 'contour',
    problem: 'Geomatic Engineering Solutions needed a professional site to show its survey services, projects and team to new clients.',
    features: [
      ['Services', 'Clear pages for every survey and engineering service.'],
      ['Projects + team', 'Past work and the people behind it build trust.'],
      ['Contact', 'A simple path from first visit to a quote request.'],
    ],
    flow: ['Next.js pages', 'React components', 'SCSS design', 'Optimised images', 'Vercel', 'Clients'],
    results: [['Next.js', 'fast pages'], ['Mobile', 'first design'], ['Vercel', 'hosting']],
  },
  crops: {
    style: 'grow',
    problem: 'Uganda’s cash-crop exporters plan without good forecasts. Ten years of UCDA data were sitting unused.',
    features: [
      ['Clean data', 'Ten years of monthly exports for 7 major cash crops, cleaned with Pandas.'],
      ['Compare models', 'Four algorithms tested; Random Forest won.'],
      ['Easy app', 'A Streamlit app lets anyone pick a crop and month and see the forecast.'],
    ],
    flow: ['UCDA records', 'Pandas cleaning', 'Feature building', '4 models compared', 'Random Forest', 'Streamlit app'],
    results: [['0.46', 'MAE'], ['7', 'cash crops'], ['10 yrs', 'of data']],
  },
};
