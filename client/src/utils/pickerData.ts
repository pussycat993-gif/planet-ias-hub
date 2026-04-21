import { PickerItem } from '../components/modals/EntityPickerModal';

// ── Mock entities — to be replaced with real PCI API ───────────
// In production these come from the PCI backend (GET /entities?search=...).
// For the demo, we hard-code a sampling that mirrors what the schema would return.

export const MOCK_ENTITIES: PickerItem[] = [
  // Events
  { id: 'e-2018-psg',   name: '2018 PSG Music Festival',           type: 'Event',                  logoColor: '#1a365d', logoAbbr: 'PSG' },
  { id: 'e-2019-psg',   name: '2019 PSG Music Festival',           type: 'Event',                  logoColor: '#1a365d', logoAbbr: 'PSG' },
  { id: 'e-2023-psg',   name: '2023 PSG Music Festival',           type: 'Event',                  logoColor: '#1a365d', logoAbbr: 'PSG' },
  { id: 'e-50th',       name: '50th Anniversary — 2020 Conservation Awareness Fund', type: 'Award & Grant Program', iconEmoji: '🏆' },

  // Companies & Partners
  { id: 'e-adriatic',   name: 'Adriatic Holdings d.o.o.',          type: 'Company',                logoColor: '#0d47a1', logoAbbr: 'AH' },
  { id: 'e-adobe',      name: 'Adobe - Captivate 8',               type: 'Software',               logoColor: '#2e7d32', logoAbbr: 'Cp' },
  { id: 'e-advent',     name: 'Advent International - Global Private Equity', type: 'Company',      logoColor: '#6a1b9a', logoAbbr: 'AI' },
  { id: 'e-goose',      name: 'Goose Creek Association',           type: 'Organization',           logoColor: '#00695c', logoAbbr: 'GC' },
  { id: 'e-oracle',     name: 'Oracle Corporation',                type: 'Company',                logoColor: '#c62828', logoAbbr: 'OR' },
  { id: 'e-microsoft',  name: 'Microsoft Corporation',             type: 'Company',                logoColor: '#0078d4', logoAbbr: 'MS' },
  { id: 'e-sap',        name: 'SAP SE',                            type: 'Company',                logoColor: '#003d7a', logoAbbr: 'SAP' },
  { id: 'e-salesforce', name: 'Salesforce Inc.',                   type: 'Company',                logoColor: '#00a1e0', logoAbbr: 'SF' },
  { id: 'e-atlassian',  name: 'Atlassian Corporation',             type: 'Company',                logoColor: '#0052cc', logoAbbr: 'AT' },

  // PLANet internal projects
  { id: 'p-ias-hub',    name: 'IAS Hub Project',                   type: 'Project',                logoColor: '#1976d2', logoAbbr: 'IH' },
  { id: 'p-dwm',        name: 'DWM Module Development',            type: 'Project',                logoColor: '#6a1b9a', logoAbbr: 'DW' },
  { id: 'p-dashboard',  name: 'Dashboard Redesign',                type: 'Project',                logoColor: '#e65100', logoAbbr: 'DR' },
  { id: 'p-pdf',        name: 'PDF Parser Module',                 type: 'Project',                logoColor: '#c62828', logoAbbr: 'PP' },
  { id: 'p-q3plan',     name: 'Q3 Strategic Plan',                 type: 'Project',                logoColor: '#2e7d32', logoAbbr: 'Q3' },
  { id: 'p-askias',     name: 'Ask IAS AI Assistant',              type: 'Project',                logoColor: '#283593', logoAbbr: 'AI' },
  { id: 'p-sprint',     name: 'IAS Sprint Board',                  type: 'Project',                logoColor: '#004d40', logoAbbr: 'SB' },
  { id: 'p-design',     name: 'Design System',                     type: 'Project',                logoColor: '#ad1457', logoAbbr: 'DS' },
  { id: 'p-onboard',    name: 'Client Onboarding',                 type: 'Project',                logoColor: '#ef6c00', logoAbbr: 'CO' },
  { id: 'p-arch',       name: 'Technical Architecture',            type: 'Project',                logoColor: '#37474f', logoAbbr: 'TA' },

  // Software / Tools
  { id: 's-figma',      name: 'Figma - Design Platform',           type: 'Software',               logoColor: '#000000', logoAbbr: 'Fg' },
  { id: 's-jira',       name: 'Jira - Atlassian',                  type: 'Software',               logoColor: '#0052cc', logoAbbr: 'Ji' },
  { id: 's-slack',      name: 'Slack - Team Communication',        type: 'Software',               logoColor: '#4a154b', logoAbbr: 'Sl' },
  { id: 's-notion',     name: 'Notion - Workspace',                type: 'Software',               logoColor: '#000000', logoAbbr: 'No' },
];

// ── Mock people — in PCI these come from the Contacts table ────
export const MOCK_PEOPLE: PickerItem[] = [
  { id: 'pp-ivana',  name: 'Ivana Vrtunic',    type: 'Person', logoColor: '#1565c0', logoAbbr: 'IV' },
  { id: 'pp-stasa',  name: 'Staša Bugarski',   type: 'Person', logoColor: '#2e7d32', logoAbbr: 'SB' },
  { id: 'pp-dean',   name: 'Dean Bedford',     type: 'Person', logoColor: '#6a1b9a', logoAbbr: 'DB' },
  { id: 'pp-veselko',name: 'Veselko Pešut',    type: 'Person', logoColor: '#c62828', logoAbbr: 'VP' },
  { id: 'pp-fedor',  name: 'Fedor Drmanović',  type: 'Person', logoColor: '#e65100', logoAbbr: 'FD' },
  { id: 'pp-pedja',  name: 'Peđa Jovanović',   type: 'Person', logoColor: '#00695c', logoAbbr: 'PJ' },
  { id: 'pp-dusan',  name: 'Dušan Mandić',     type: 'Person', logoColor: '#283593', logoAbbr: 'DM' },
  { id: 'pp-marko',  name: 'Marko Petrović',   type: 'Person', logoColor: '#4a148c', logoAbbr: 'MP' },
  { id: 'pp-ana',    name: 'Ana Kovač',        type: 'Person', logoColor: '#880e4f', logoAbbr: 'AK' },
  { id: 'pp-mladja', name: 'Mladen Savić',     type: 'Person', logoColor: '#bf360c', logoAbbr: 'MS' },
  { id: 'pp-vlada',  name: 'Vladimir Jovanović', type: 'Person', logoColor: '#37474f', logoAbbr: 'VJ' },
  { id: 'pp-dino',   name: 'Dino Filipović',   type: 'Person', logoColor: '#006064', logoAbbr: 'DF' },
];

// ── Mock tags ──────────────────────────────────────────────────
export const MOCK_TAGS: PickerItem[] = [
  { id: 't-urgent',      name: 'Urgent',            type: 'Tag', iconEmoji: '🔴' },
  { id: 't-followup',    name: 'Follow Up',         type: 'Tag', iconEmoji: '🔄' },
  { id: 't-review',      name: 'Review',            type: 'Tag', iconEmoji: '👀' },
  { id: 't-client',      name: 'Client',            type: 'Tag', iconEmoji: '🤝' },
  { id: 't-internal',    name: 'Internal',          type: 'Tag', iconEmoji: '🏠' },
  { id: 't-external',    name: 'External',          type: 'Tag', iconEmoji: '🌐' },
  { id: 't-contract',    name: 'Contract',          type: 'Tag', iconEmoji: '📄' },
  { id: 't-proposal',    name: 'Proposal',          type: 'Tag', iconEmoji: '💼' },
  { id: 't-discovery',   name: 'Discovery',         type: 'Tag', iconEmoji: '🔍' },
  { id: 't-kickoff',     name: 'Kickoff',           type: 'Tag', iconEmoji: '🚀' },
  { id: 't-training',    name: 'Training',          type: 'Tag', iconEmoji: '📚' },
  { id: 't-demo',        name: 'Demo',              type: 'Tag', iconEmoji: '🎬' },
  { id: 't-retro',       name: 'Retrospective',     type: 'Tag', iconEmoji: '🔁' },
  { id: 't-planning',    name: 'Planning',          type: 'Tag', iconEmoji: '📋' },
  { id: 't-confidential',name: 'Confidential',      type: 'Tag', iconEmoji: '🔒' },
];
