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
