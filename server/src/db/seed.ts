import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ias_hub',
  user: process.env.DB_USER || 'ias_hub_user',
  password: process.env.DB_PASS,
});

const TEAM_MEMBERS = [
  { email: 'veselko.pesut@planetsg.com',   name: 'Veselko Pešut',   role: 'Senior Developer' },
  { email: 'stasa.bugarski@planetsg.com',  name: 'Staša Bugarski',  role: 'Senior Developer' },
  { email: 'dean.bedford@planetsg.com',    name: 'Dean Bedford',    role: 'President' },
  { email: 'pedja.jovanovic@planetsg.com', name: 'Peđa Jovanović',  role: 'Project Manager' },
  { email: 'dusan.mandic@planetsg.com',    name: 'Dušan Mandić',    role: 'UX/UI Designer & Developer' },
  { email: 'fedor.drmanovic@planetsg.com', name: 'Fedor Drmanović', role: 'QA' },
  { email: 'ivana.vrtunic@planetsg.com',   name: 'Ivana Vrtunic',   role: 'Project Manager' },
];

const DM_CONVERSATIONS: Record<string, { from: 'me' | 'them'; body: string; minsAgo: number }[]> = {

  'stasa.bugarski@planetsg.com': [
    { from: 'them', body: 'Ivana, dobro jutro! Pogledao sam IAS-488 zahtjeve, imam par pitanja oko workflow engine-a.', minsAgo: 8640 },
    { from: 'me',   body: 'Dobro jutro Staša! Naravno, pitaj slobodno.', minsAgo: 8630 },
    { from: 'them', body: 'Da li workflow state treba živjeti na Activity recordu ili na zasebnoj tabeli?', minsAgo: 8625 },
    { from: 'me',   body: 'Na Activity recordu — svaki step kreira child Activity koji nasljeđuje People, Entities i Tags od parenta.', minsAgo: 8615 },
    { from: 'them', body: 'OK razumijem. A parallel group execution sa join_policy ALL/ANY — to je isto na Activity nivou?', minsAgo: 8610 },
    { from: 'me',   body: 'Da, join_policy je polje na workflow_step tabeli. Provjeri Confluence, ima detaljnu dokumentaciju.', minsAgo: 8600 },
    { from: 'them', body: 'Vidim, odlično. Počinjem implementaciju, dat ću ti update do kraja dana.', minsAgo: 8590 },
    { from: 'me',   body: '👍 Javi ako zapneš negdje.', minsAgo: 8585 },
    { from: 'them', body: 'Ivana, završio sam IAS-488 backend. SQL migracija je na Bitbucketu, možeš pogledati?', minsAgo: 1560 },
    { from: 'me',   body: 'Super brzo! Odmah pogledam. Je li IAS-530 step actions panel uključen?', minsAgo: 1555 },
    { from: 'them', body: 'Da, sve je unutra. Samo trebam review na jednu stvar — da li koristimo PascalCase za timestamp kolone?', minsAgo: 1550 },
    { from: 'me',   body: 'Da, konvencija je xx_TimeStamp_* — npr. xx_TimeStamp_Created. Provjeri CLAUDE.md.', minsAgo: 1548 },
    { from: 'them', body: 'Ispravio, hvala. Push ide sada.', minsAgo: 1540 },
    { from: 'me',   body: 'Okej, šaljem feedback do kraja radnog dana.', minsAgo: 1535 },
    { from: 'them', body: 'Btw, IAS-532 conditional dropdown je takodjer done. Podržava dependent fields.', minsAgo: 45 },
    { from: 'me',   body: '👏 Odlično! Updateuj Jiru i prebaci na Done.', minsAgo: 40 },
    { from: 'them', body: 'Već sam, IAS-532 je Done. Sutra se hvatam IAS-533 Role Management modal.', minsAgo: 35 },
    { from: 'me',   body: 'Savršeno. Ako ti treba business logika za role permissions, javi — imam spec.', minsAgo: 30 },
  ],

  'dean.bedford@planetsg.com': [
    { from: 'them', body: 'Ivana, kada planiramo demo IAS Hub-a za tim?', minsAgo: 10080 },
    { from: 'me',   body: 'Dean, planiram do kraja ove sedmice. Sve core funkcionalnosti su implementirane.', minsAgo: 10070 },
    { from: 'them', body: 'Odlično. Možemo li pozvati Mladju i Vladu na preview?', minsAgo: 10060 },
    { from: 'me',   body: 'Da, predlažem utorak ili srijedu sljedeće sedmice. Trebaš li da organizujem pozivnice?', minsAgo: 10050 },
    { from: 'them', body: 'Molim te da. Uključi i Dina ako bude slobodan.', minsAgo: 10040 },
    { from: 'me',   body: 'Naravno. Šaljem invite za srijedu 10h. Zoom ili IAS Hub poziv? 😄', minsAgo: 10030 },
    { from: 'them', body: 'Ha, IAS Hub naravno! Treba da testiramo produkt na pravom primjeru.', minsAgo: 10020 },
    { from: 'me',   body: 'Slažem se, koristimo naš vlastiti alat. Savršen stress test. Šaljem invite.', minsAgo: 10010 },
    { from: 'them', body: 'Ivana, vidio sam Q2 report. Sjajan progres na IAS projektu. Tiku pohvale.', minsAgo: 4680 },
    { from: 'me',   body: 'Hvala Dean, tim je radio odlično. Staša i Veselko su se posebno istakli na backend strani.', minsAgo: 4670 },
    { from: 'them', body: 'Svakako. Ima li nešto što nam treba za Q3 — resursi, alati, budžet?', minsAgo: 4660 },
    { from: 'me',   body: 'Za sada smo dobro. Možda ćemo trebati još jednog QA-a kad krene client onboarding.', minsAgo: 4650 },
    { from: 'them', body: 'Razumno. Napravi prijedlog kad budeš sprema, razmotrit ćemo.', minsAgo: 4640 },
    { from: 'me',   body: 'Naravno, imam to na umu za Q3 planning. Hvala Dean!', minsAgo: 4630 },
    { from: 'them', body: 'Odlično. Kako napreduje DWM modul?', minsAgo: 2940 },
    { from: 'me',   body: 'Workflow Detail page je u finalnoj fazi, Staša završava Role Management. Execution engine ide sljedeći.', minsAgo: 2930 },
    { from: 'them', body: 'Super. Klijenti su jako zainteresovani za taj dio. Drži me u toku.', minsAgo: 2920 },
    { from: 'me',   body: 'Apsolutno, šaljem tjedni status report kao i inače.', minsAgo: 2910 },
  ],

  'pedja.jovanovic@planetsg.com': [
    { from: 'me',   body: 'Peđa, kako ide PDF parsing? Ima li problema sa implementacijom?', minsAgo: 7200 },
    { from: 'them', body: 'Ivana, ide solidno. Imam problem sa scanned PDF-ovima — OCR rezultati su ponekad loši.', minsAgo: 7190 },
    { from: 'me',   body: 'Poznato. Probaj Tesseract sa preprocessing korakom — rotacija i kontrast poboljšanje.', minsAgo: 7180 },
    { from: 'them', body: 'Dobra ideja. A za handwritten text — ima li šanse da ikad bude OK?', minsAgo: 7170 },
    { from: 'me',   body: 'Iskreno, za v1 to excluded iz scope. Fokus je na printed PDF-ovima. Stavi u backlog.', minsAgo: 7160 },
    { from: 'them', body: 'Razumijem, ima smisla. Ću dokumentirati kao limitation.', minsAgo: 7150 },
    { from: 'me',   body: 'Tačno. A kako stojite sa rokovima?', minsAgo: 7140 },
    { from: 'them', body: 'Trebam još 2-3 dana za stabilizaciju. Onda ide na testiranje Fedoru.', minsAgo: 7130 },
    { from: 'me',   body: 'Okej, koordiniraj sa njim direktno. Ja ću kreirati Jira task za handoff.', minsAgo: 7120 },
    { from: 'them', body: 'Savršeno, hvala!', minsAgo: 7110 },
    { from: 'them', body: 'Ivana, trebam DWM specifikaciju. Konkretno — kako workflow zna na koji Activity tip da se okine?', minsAgo: 3180 },
    { from: 'me',   body: 'To je trigger_activity_type polje na workflow tabeli. Filter koji matchuje tip activnosti prilikom kreiranja.', minsAgo: 3170 },
    { from: 'them', body: 'Ah, i to može biti više tipova ili samo jedan?', minsAgo: 3165 },
    { from: 'me',   body: 'Za sada jedan tip po workflowu. Multiple types su u planu za v2. Provjeri Confluence IAS-535 dokumentaciju.', minsAgo: 3160 },
    { from: 'them', body: 'Vidim stranicu, odlično je dokumentovano! Još jedno — trigger_entity_id je opcionalan filter?', minsAgo: 3155 },
    { from: 'me',   body: 'Da, opcionalan. Ako je setovan, workflow se okida samo za tu specifičnu Entity. Inače za sve.', minsAgo: 3150 },
    { from: 'them', body: 'Kristalno jasno sada. Mogu početi implementaciju.', minsAgo: 3145 },
    { from: 'me',   body: 'Super! Javi ako ima još pitanja. I updateuj Jiru kad završiš svaki task.', minsAgo: 3140 },
    { from: 'them', body: 'Naravno. Sutra ujutro da prođemo zajedno kroz arhitekturu?', minsAgo: 1940 },
    { from: 'me',   body: 'Može, 9h?', minsAgo: 1935 },
    { from: 'them', body: '9h savršeno. Šaljem Google Meet link.', minsAgo: 1930 },
    { from: 'me',   body: 'Hajde na IAS Hub call, ionako testiramo 😄', minsAgo: 1925 },
    { from: 'them', body: 'Ha, u pravu si! IAS Hub poziv u 9h, potvrđujem.', minsAgo: 1920 },
  ],

  'dusan.mandic@planetsg.com': [
    { from: 'them', body: 'Ivana, završio sam prve skice za Dashboard. Mogu li da podijelim sa tobom?', minsAgo: 11520 },
    { from: 'me',   body: 'Naravno, jedva čekam da vidim!', minsAgo: 11510 },
    { from: 'them', body: 'Šaljem Figma link: figma.com/file/... — ima 3 varijante layouta.', minsAgo: 11505 },
    { from: 'me',   body: 'Gledam... Varijanta B mi se najviše sviđa. Tab navigacija je čista, stats kartice su vidljive.', minsAgo: 11490 },
    { from: 'them', body: 'I meni B. Mijenjam li Ask IAS widget — možda da bude malo veći, prominence?', minsAgo: 11485 },
    { from: 'me',   body: 'Da, točno to sam mislila. Taj widget je key feature, treba da bude u fokusu.', minsAgo: 11480 },
    { from: 'them', body: 'OK, radim update. I boja — zadržavamo #1565c0 kao primary?', minsAgo: 11475 },
    { from: 'me',   body: 'Obavezno, to je PLANet brand boja. Ne smijemo mijenjati.', minsAgo: 11470 },
    { from: 'them', body: 'Razumijem. Font je Arial/Segoe UI?', minsAgo: 11465 },
    { from: 'me',   body: 'Da, Segoe UI primarno, Arial kao fallback. Isti kao u PCI aplikaciji.', minsAgo: 11460 },
    { from: 'them', body: 'Perfektno. Imam update za tebe! Pogledaj novu verziju Dashboarda.', minsAgo: 7380 },
    { from: 'me',   body: 'Odlično Dušane! Ask IAS widget je sad puno bolje. Approve!', minsAgo: 7370 },
    { from: 'them', body: 'Super! Mogu li početi sa Expiring Soon sekcijom?', minsAgo: 7365 },
    { from: 'me',   body: 'Da, to je sljedeće. Treba da prikaže pasoševe, vize i pretplate sa color-coded countdown.', minsAgo: 7360 },
    { from: 'them', body: 'Urgent = crvena, Soon = narančasta, OK = zelena?', minsAgo: 7355 },
    { from: 'me',   body: 'Tačno. Urgent < 30 dana, Soon 30-90 dana, OK > 90 dana.', minsAgo: 7350 },
    { from: 'them', body: 'Jasno. Šaljem mockup do sutra.', minsAgo: 7345 },
    { from: 'me',   body: 'Odlično, hvala!', minsAgo: 7340 },
    { from: 'them', body: 'Ivana, šta misliš — da li da dodamo dark mode?', minsAgo: 5940 },
    { from: 'me',   body: 'Za sada ne, nije u scope za v1. Stavi u backlog, moguće za v2.', minsAgo: 5935 },
    { from: 'them', body: 'Razumijem. A responsive design za tablet?', minsAgo: 5930 },
    { from: 'me',   body: 'Isto v2. Fokus je desktop za sada — Electron app primarno.', minsAgo: 5925 },
    { from: 'them', body: 'OK, zadržavam desktop fokus. Kad su rokovi za IAS Hub UI review?', minsAgo: 5920 },
    { from: 'me',   body: 'Cilj je do kraja sedmice da imamo sve mockupe odobrene, pa kreće implementacija.', minsAgo: 5915 },
    { from: 'them', body: 'Bit ću spreman. Hvala Ivana! 🙏', minsAgo: 5910 },
  ],

  'fedor.drmanovic@planetsg.com': [
    { from: 'me',   body: 'Fedor, možeš li ovaj tjedan početi QA za IAS Hub?', minsAgo: 5760 },
    { from: 'them', body: 'Naravno Ivana, koji dio da pokrijem kao prioritet?', minsAgo: 5750 },
    { from: 'me',   body: 'Počni sa auth flowom — SSO i standalone login. Pa messaging i file upload.', minsAgo: 5745 },
    { from: 'them', body: 'OK. Imam li pristup staging environmentu?', minsAgo: 5740 },
    { from: 'me',   body: 'Da, šaljem ti kredencijale na email. Dev server je na localhost:5174.', minsAgo: 5735 },
    { from: 'them', body: 'Primio, hvala. Pokrećem testove.', minsAgo: 5730 },
    { from: 'them', body: 'Ivana, pronašao sam prvi bug. Na login page — kad uneseš pogrešne kredencijale, error poruka ostaje i nakon što počneš kucati novu lozinku.', minsAgo: 1740 },
    { from: 'me',   body: 'Hvala Fedore! To je minor UX bug. Otvori Jira task u HUB projektu i dodaj screenshot.', minsAgo: 1735 },
    { from: 'them', body: 'Kreirao HUB-14. Ima još jedan problem — socket connection se ponekad ne reconnecta automatski nakon network dropout.', minsAgo: 1725 },
    { from: 'me',   body: 'Taj je poznatiji issue, Staša će ga pogledati. Kreiraj i za to task, označi ga kao Medium.', minsAgo: 1720 },
    { from: 'them', body: 'Kreirao HUB-15. Inače auth flow radi odlično, SSO je smooth.', minsAgo: 1715 },
    { from: 'me',   body: 'Odlično! Nastavi sa messaging testovima. Provjeri i DM kreiranje i file upload.', minsAgo: 1710 },
    { from: 'them', body: 'Messaging je stabilan. File upload radi za sve tipove koje sam testirao — PDF, PNG, DOCX.', minsAgo: 1200 },
    { from: 'me',   body: 'Super! Provjeri i limits — šta se dešava sa fajlom > 10MB?', minsAgo: 1195 },
    { from: 'them', body: 'Testirao — dobivam error ali poruka nije user-friendly. Kreirao HUB-16.', minsAgo: 1190 },
    { from: 'me',   body: 'Odlično hvatanje! Hvala.', minsAgo: 1185 },
    { from: 'them', body: 'Ivana, DWM flow sam testirao jucer. Approve/Reject akcije rade perfektno.', minsAgo: 90 },
    { from: 'me',   body: 'Super vijesti! Znaci IAS-488 mozemo zatvoriti na QA strani?', minsAgo: 85 },
    { from: 'them', body: 'Da, QA pass. Samo HUB-15 socket issue ostaje otvoren.', minsAgo: 80 },
    { from: 'me',   body: 'Odlično Fedore, hvala na thorough testiranju! Stavit ću te na sljedeći sprint planning.', minsAgo: 75 },
  ],

  'veselko.pesut@planetsg.com': [
    { from: 'them', body: 'Ivana, dobro jutro. Pogledao sam IAS-488 specifikaciju. Imam prijedlog za DB indexing strategiju.', minsAgo: 10080 },
    { from: 'me',   body: 'Dobro jutro Veselko! Super, što predlažeš?', minsAgo: 10070 },
    { from: 'them', body: 'Composite index na (workflow_id, step_order) za brže query-janje koraka. I partial index za active workflows.', minsAgo: 10065 },
    { from: 'me',   body: 'Odlično razmišljanje. Slažem se, dodaj to u migraciju i dokumentuj u DB schema docs.', minsAgo: 10055 },
    { from: 'them', body: 'Naravno. I još jedno — da li koristimo soft delete ili hard delete za workflow steps?', minsAgo: 10050 },
    { from: 'me',   body: 'Soft delete, isti pattern kao u ostatku sistema. Kolona deleted_at.', minsAgo: 10040 },
    { from: 'them', body: 'Savršeno, konzistentno sa ostalim. Krećem na implementaciju.', minsAgo: 10030 },
    { from: 'me',   body: 'Odlično! Javi me kad bude PR spreman za review.', minsAgo: 10020 },
    { from: 'them', body: 'Ivana, PR je na Bitbucketu kada možeš pogledati.', minsAgo: 5940 },
    { from: 'me',   body: 'Gledam odmah...', minsAgo: 5930 },
    { from: 'me',   body: 'Sve izgleda solidno. Jedan komentar — u auth middleware-u, JWT validation bi trebalo da bude strožija za admin rute.', minsAgo: 5920 },
    { from: 'them', body: 'Razumijem, dodajem role check. Ima smisla.', minsAgo: 5910 },
    { from: 'them', body: 'Ispravio i pushao novu verziju. Role check je sada na svim /admin/* rutama.', minsAgo: 5860 },
    { from: 'me',   body: 'Approved 👍 Merge-aj!', minsAgo: 5850 },
    { from: 'them', body: 'Merged. Hvala na review-u Ivana.', minsAgo: 5840 },
    { from: 'them', body: 'Ivana, razmišljam o Q3 arhitekturi. Možemo li uvesti microservices za notification engine?', minsAgo: 3000 },
    { from: 'me',   body: 'Zanimljiva ideja. Za sada smo monolitni što olakšava deployment. Microservices bi komplicirali setup.', minsAgo: 2995 },
    { from: 'them', body: 'Razumijem. Možda hibridni pristup — notification kao izolovani modul ali unutar monolita?', minsAgo: 2990 },
    { from: 'me',   body: 'To već imamo zapravo — smartNotifications.ts je potpuno izolovan. To je dobar pattern.', minsAgo: 2985 },
    { from: 'them', body: 'Tačno, nisam bio svjestan da je već tako strukturisano. Respect 👏', minsAgo: 2980 },
    { from: 'me',   body: 'Zasluga i za tebe i ostatak tima. Ako hoćeš da uradimo architecture review za Q3, stavit ću to na agendu.', minsAgo: 2975 },
    { from: 'them', body: 'Bilo bi odlično! Hvala Ivana.', minsAgo: 2970 },
  ],
};

const SHARED_FILES: Record<string, { name: string; mime: string; size: number; minsAgo: number }[]> = {
  'stasa.bugarski@planetsg.com': [
    { name: 'DWM_Backend_Architecture.pdf', mime: 'application/pdf',  size: 1240000, minsAgo: 8580 },
    { name: 'IAS-488_Migration.sql',        mime: 'text/plain',        size: 8400,    minsAgo: 1540 },
    { name: 'workflow_engine_notes.md',     mime: 'text/plain',        size: 3200,    minsAgo: 40  },
  ],
  'dean.bedford@planetsg.com': [
    { name: 'IAS_Hub_Demo_Script.docx',     mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 45000,   minsAgo: 10000 },
    { name: 'PLANet_Q2_Report.xlsx',        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       size: 320000,  minsAgo: 4620  },
    { name: 'Q3_Resource_Planning.docx',    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 28000,   minsAgo: 2900  },
  ],
  'pedja.jovanovic@planetsg.com': [
    { name: 'DWM_Workflow_Spec_v2.pdf',      mime: 'application/pdf',  size: 980000,  minsAgo: 3140 },
    { name: 'PDF_Parsing_Requirements.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 67000, minsAgo: 3135 },
    { name: 'trigger_logic_diagram.png',     mime: 'image/png',         size: 450000,  minsAgo: 1915 },
  ],
  'dusan.mandic@planetsg.com': [
    { name: 'Dashboard_Mockup_v1.png',       mime: 'image/png',         size: 1800000, minsAgo: 11500 },
    { name: 'Dashboard_Mockup_v3_final.png', mime: 'image/png',         size: 2100000, minsAgo: 7370  },
    { name: 'IAS_Hub_Design_System.fig',     mime: 'application/octet-stream', size: 4500000, minsAgo: 7365 },
    { name: 'Color_Palette_PLANet.pdf',      mime: 'application/pdf',   size: 340000,  minsAgo: 5900  },
  ],
  'fedor.drmanovic@planetsg.com': [
    { name: 'QA_Test_Plan_IAS_Hub.xlsx',     mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 125000, minsAgo: 5720 },
    { name: 'QA_Test_Report_April.xlsx',     mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 198000, minsAgo: 90   },
    { name: 'HUB-14_Screenshot.png',         mime: 'image/png',         size: 890000,  minsAgo: 1725 },
    { name: 'HUB-15_Socket_Log.txt',         mime: 'text/plain',        size: 12000,   minsAgo: 1720 },
  ],
  'veselko.pesut@planetsg.com': [
    { name: 'Architecture_Proposal_Q3.pdf',  mime: 'application/pdf',   size: 1560000, minsAgo: 2970 },
    { name: 'DB_Indexing_Strategy.md',       mime: 'text/plain',        size: 4800,    minsAgo: 10060 },
  ],
};

const CALL_HISTORY: Record<string, { type: 'audio' | 'video'; duration: number; minsAgo: number }[]> = {
  'stasa.bugarski@planetsg.com': [
    { type: 'video', duration: 2820, minsAgo: 8600 },
    { type: 'audio', duration: 840,  minsAgo: 1545 },
    { type: 'video', duration: 1560, minsAgo: 44   },
  ],
  'dean.bedford@planetsg.com': [
    { type: 'video', duration: 5400, minsAgo: 10060 },
    { type: 'video', duration: 3600, minsAgo: 4660  },
    { type: 'audio', duration: 900,  minsAgo: 2925  },
  ],
  'pedja.jovanovic@planetsg.com': [
    { type: 'audio', duration: 1260, minsAgo: 7155 },
    { type: 'video', duration: 2100, minsAgo: 3160 },
    { type: 'video', duration: 3480, minsAgo: 1920 },
  ],
  'dusan.mandic@planetsg.com': [
    { type: 'video', duration: 4200, minsAgo: 11480 },
    { type: 'video', duration: 2700, minsAgo: 7360  },
  ],
  'fedor.drmanovic@planetsg.com': [
    { type: 'audio', duration: 720,  minsAgo: 5735 },
    { type: 'video', duration: 2400, minsAgo: 1730 },
    { type: 'audio', duration: 480,  minsAgo: 85   },
  ],
  'veselko.pesut@planetsg.com': [
    { type: 'video', duration: 3300, minsAgo: 10050 },
    { type: 'video', duration: 4500, minsAgo: 5860  },
    { type: 'audio', duration: 960,  minsAgo: 2975  },
  ],
};

const GROUP_MESSAGES = [
  { email: 'dean.bedford@planetsg.com',    body: 'Dobro jutro ekipo! Kako napreduje sprint?', minsAgo: 8640 },
  { email: 'ivana.vrtunic@planetsg.com',   body: 'Dobro jutro Dean! Staša završava IAS-488, Veselko na code review. Sve po planu.', minsAgo: 8630 },
  { email: 'stasa.bugarski@planetsg.com',  body: 'Da, IAS-488 backend je gotov. Čekam review.', minsAgo: 8625 },
  { email: 'veselko.pesut@planetsg.com',   body: 'Gledam PR, do 12h ću dati feedback.', minsAgo: 8620 },
  { email: 'fedor.drmanovic@planetsg.com', body: 'Ja ću početi QA čim Veselko approva.', minsAgo: 8615 },
  { email: 'dean.bedford@planetsg.com',    body: 'Odlično, super koordinacija ekipo! 💪', minsAgo: 8610 },
  { email: 'dusan.mandic@planetsg.com',    body: 'Ivana, poslao sam novi Dashboard mockup. Provjeri inbox.', minsAgo: 7380 },
  { email: 'ivana.vrtunic@planetsg.com',   body: 'Vidim Dušane, izgleda odlično! Approve za v3.', minsAgo: 7370 },
  { email: 'pedja.jovanovic@planetsg.com', body: 'Ja i PDF parser modul trebam još 2 dana.', minsAgo: 7360 },
  { email: 'ivana.vrtunic@planetsg.com',   body: 'OK Peđa, koordiniraj sa Fedorom za handoff.', minsAgo: 7350 },
  { email: 'stasa.bugarski@planetsg.com',  body: 'IAS-530 i IAS-532 su mergeani i na staging-u.', minsAgo: 3060 },
  { email: 'fedor.drmanovic@planetsg.com', body: 'Vidim, krećem na testiranje! 🧪', minsAgo: 3055 },
  { email: 'veselko.pesut@planetsg.com',   body: 'Prošao sam architecture review za Q3. Imam prijedloge, hoćemo li kratki call?', minsAgo: 3050 },
  { email: 'ivana.vrtunic@planetsg.com',   body: 'Svakako! Sutra u 15h svi slobodni?', minsAgo: 3045 },
  { email: 'dean.bedford@planetsg.com',    body: 'Ja mogu.', minsAgo: 3040 },
  { email: 'stasa.bugarski@planetsg.com',  body: '👍', minsAgo: 3038 },
  { email: 'pedja.jovanovic@planetsg.com', body: 'Mogu!', minsAgo: 3035 },
  { email: 'fedor.drmanovic@planetsg.com', body: 'I ja 🙋', minsAgo: 3032 },
  { email: 'dusan.mandic@planetsg.com',    body: 'Potvrđujem!', minsAgo: 3030 },
  { email: 'ivana.vrtunic@planetsg.com',   body: 'Odlično! Sutra 15h na IAS Hub — šaljem invite.', minsAgo: 3025 },
  { email: 'fedor.drmanovic@planetsg.com', body: 'QA report za ovaj sprint je u Files tabu. Ima 3 buga, sve minor.', minsAgo: 1500 },
  { email: 'ivana.vrtunic@planetsg.com',   body: 'Pogledala, hvala Fedore. Staša možeš ih adresirati danas?', minsAgo: 1495 },
  { email: 'stasa.bugarski@planetsg.com',  body: 'Da, HUB-14 i HUB-16 su trivijalni. HUB-15 socket issue trebat će malo više vremena.', minsAgo: 1490 },
  { email: 'ivana.vrtunic@planetsg.com',   body: 'Razumijem, uzmi koliko treba. Kvalitet je prioritet.', minsAgo: 1485 },
  { email: 'veselko.pesut@planetsg.com',   body: 'Mogu pomoći sa HUB-15 ako treba Staša, radio sam na socket reconnect logici ranije.', minsAgo: 1480 },
  { email: 'stasa.bugarski@planetsg.com',  body: 'Cijenio bi, DM-ujem te.', minsAgo: 1475 },
  { email: 'dean.bedford@planetsg.com',    body: 'Ekipa, client je jako zadovoljan progresom. Odlican posao svima! 🎉', minsAgo: 720 },
  { email: 'ivana.vrtunic@planetsg.com',   body: 'Hvala Dean! Ekipa je fenomenalna 🙏', minsAgo: 715 },
  { email: 'dusan.mandic@planetsg.com',    body: '🎉🎉🎉 Idemo dalje!', minsAgo: 710 },
  { email: 'pedja.jovanovic@planetsg.com', body: 'Ponosni smo na ovaj produkt!', minsAgo: 705 },
  { email: 'stasa.bugarski@planetsg.com',  body: 'IAS-533 Role Management modal je done! 🎯', minsAgo: 30 },
  { email: 'ivana.vrtunic@planetsg.com',   body: 'Sjajno Staša! Updateuj Jiru i idi na odmor, zaslužio si 😄', minsAgo: 25 },
  { email: 'fedor.drmanovic@planetsg.com', body: 'Testiram odmah! 🧪', minsAgo: 20 },
];

function minsAgoDate(minsAgo: number): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() - minsAgo);
  return d;
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🌱 Seeding IAS Hub database...\n');

    const tenantId = process.env.TENANT_ID || 'default';

    // ── Automation settings ───────────────────────────────
    await client.query(`
      INSERT INTO automation_settings (tenant_id, smart_logger, meeting_briefing, briefing_minutes_before, dwm_trigger, auto_channel, smart_notif)
      VALUES ($1, true, true, 15, true, false, true)
      ON CONFLICT (tenant_id) DO NOTHING
    `, [tenantId]);

    // ── Public channels ───────────────────────────────────
    for (const ch of [
      { name: 'general',     desc: 'General team communication' },
      { name: 'development', desc: 'Development discussions' },
      { name: 'ias-project', desc: 'IAS Hub project channel' },
    ]) {
      await client.query(`INSERT INTO channels (name, type, description) VALUES ($1, 'public', $2) ON CONFLICT DO NOTHING`, [ch.name, ch.desc]);
    }

    // ── Workgroup Team group ──────────────────────────────
    const { rows: wgRows } = await client.query(`
      INSERT INTO channels (name, type, description, logo_color, logo_abbr)
      VALUES ('Workgroup Team', 'group', 'PLANet Systems Group core team', '#1565c0', 'WT')
      ON CONFLICT DO NOTHING RETURNING id
    `);
    let workgroupId: number;
    if (wgRows[0]) {
      workgroupId = wgRows[0].id;
    } else {
      const { rows } = await client.query(`SELECT id FROM channels WHERE name = 'Workgroup Team' LIMIT 1`);
      workgroupId = rows[0].id;
    }

    // ── Admin ─────────────────────────────────────────────
    const adminHash = await bcrypt.hash('Admin@IASHub2026!', 12);
    await client.query(`
      INSERT INTO users (email, name, role, user_type, password_hash, tenant_id)
      VALUES ('admin@iashub.local', 'IAS Hub Admin', 'admin', 'standalone', $1, $2)
      ON CONFLICT (email) DO NOTHING
    `, [adminHash, tenantId]);

    // ── Team members ──────────────────────────────────────
    const defaultPass = await bcrypt.hash('PLANet@2026!', 12);
    const userIdMap: Record<string, number> = {};

    for (const member of TEAM_MEMBERS) {
      const { rows } = await client.query(`
        INSERT INTO users (email, name, role, user_type, password_hash, tenant_id, status)
        VALUES ($1, $2, $3, 'standalone', $4, $5, 'online')
        ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
        RETURNING id
      `, [member.email, member.name, member.role, defaultPass, tenantId]);

      const uid = rows[0].id;
      userIdMap[member.email] = uid;

      const { rows: pubs } = await client.query(`SELECT id FROM channels WHERE type = 'public'`);
      for (const ch of pubs) {
        await client.query(`INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [ch.id, uid]);
      }
      await client.query(`INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [workgroupId, uid]);
    }
    console.log(`  ✅ ${TEAM_MEMBERS.length} team members created`);

    const ivanaId = userIdMap['ivana.vrtunic@planetsg.com'];

    // ── DM channels ───────────────────────────────────────
    for (const member of TEAM_MEMBERS) {
      if (member.email === 'ivana.vrtunic@planetsg.com') continue;

      const otherId = userIdMap[member.email];
      const dmName = `dm-${[ivanaId, otherId].sort().join('-')}`;

      const { rows: dmRows } = await client.query(`
        INSERT INTO channels (name, type, description)
        VALUES ($1, 'dm', $2) ON CONFLICT DO NOTHING RETURNING id
      `, [dmName, `DM: Ivana Vrtunic & ${member.name}`]);

      let dmId: number;
      if (dmRows[0]) {
        dmId = dmRows[0].id;
      } else {
        const { rows } = await client.query(`SELECT id FROM channels WHERE name = $1 LIMIT 1`, [dmName]);
        if (!rows[0]) continue;
        dmId = rows[0].id;
      }

      await client.query(`INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [dmId, ivanaId]);
      await client.query(`INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [dmId, otherId]);

      // Messages
      const convo = DM_CONVERSATIONS[member.email] || [];
      for (const msg of convo) {
        const senderId = msg.from === 'me' ? ivanaId : otherId;
        await client.query(`
          INSERT INTO messages (channel_id, sender_id, body, message_type, created_at)
          VALUES ($1, $2, $3, 'text', $4)
        `, [dmId, senderId, msg.body, minsAgoDate(msg.minsAgo)]);
      }

      // Files
      const files = SHARED_FILES[member.email] || [];
      for (const f of files) {
        const ts = minsAgoDate(f.minsAgo);
        const { rows: fMsgRows } = await client.query(`
          INSERT INTO messages (channel_id, sender_id, body, message_type, created_at)
          VALUES ($1, $2, $3, 'file', $4) RETURNING id
        `, [dmId, otherId, f.name, ts]);

        await client.query(`
          INSERT INTO files (message_id, channel_id, uploaded_by, file_name, file_size, mime_type, storage_path, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [fMsgRows[0].id, dmId, otherId, f.name, f.size, f.mime, `/uploads/mock/${f.name}`, ts]);
      }

      // Calls
      const calls = CALL_HISTORY[member.email] || [];
      for (const call of calls) {
        const startedAt = minsAgoDate(call.minsAgo);
        const endedAt = new Date(startedAt.getTime() + call.duration * 1000);

        const { rows: callRows } = await client.query(`
          INSERT INTO call_logs (channel_id, call_type, started_at, ended_at, duration_secs, started_by)
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        `, [dmId, call.type, startedAt, endedAt, call.duration, ivanaId]);

        await client.query(`INSERT INTO call_participants (call_id, user_id, left_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [callRows[0].id, ivanaId, endedAt]);
        await client.query(`INSERT INTO call_participants (call_id, user_id, left_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [callRows[0].id, otherId, endedAt]);
      }

      console.log(`  ✅ ${member.name}: ${convo.length} poruka, ${files.length} fajlova, ${calls.length} poziva`);
    }

    // ── Workgroup Team messages ───────────────────────────
    for (const msg of GROUP_MESSAGES) {
      const senderId = userIdMap[msg.email];
      if (!senderId) continue;
      await client.query(`
        INSERT INTO messages (channel_id, sender_id, body, message_type, created_at)
        VALUES ($1, $2, $3, 'text', $4)
      `, [workgroupId, senderId, msg.body, minsAgoDate(msg.minsAgo)]);
    }
    console.log(`  ✅ Workgroup Team: ${GROUP_MESSAGES.length} poruka`);

    await client.query('COMMIT');

    console.log('\n✅ Seed complete!\n');
    console.log('  Prijava: <ime.prezime>@planetsg.com  /  PLANet@2026!');
    console.log('  Admin:   admin@iashub.local          /  Admin@IASHub2026!\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
