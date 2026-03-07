"use strict";var hs=Object.create;var x=Object.defineProperty;var Ss=Object.getOwnPropertyDescriptor;var bs=Object.getOwnPropertyNames;var Rs=Object.getPrototypeOf,Os=Object.prototype.hasOwnProperty;var Is=(n,e)=>{for(var s in e)x(n,s,{get:e[s],enumerable:!0})},oe=(n,e,s,t)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of bs(e))!Os.call(n,r)&&r!==s&&x(n,r,{get:()=>e[r],enumerable:!(t=Ss(e,r))||t.enumerable});return n};var D=(n,e,s)=>(s=n!=null?hs(Rs(n)):{},oe(e||!n||!n.__esModule?x(s,"default",{value:n,enumerable:!0}):s,n)),fs=n=>oe(x({},"__esModule",{value:!0}),n);var Gs={};Is(Gs,{generateContext:()=>re});module.exports=fs(Gs);var Ts=D(require("path"),1),gs=require("os"),Ns=require("fs");var y=require("crypto"),Se=require("bun:sqlite");var S=require("path"),pe=require("os"),me=require("fs");var le=require("url");var f=require("fs"),w=require("path"),de=require("os");var ie="bugfix,feature,refactor,discovery,decision,change",ae="how-it-works,why-it-exists,what-changed,problem-solution,gotcha,pattern,trade-off";var A=class{static DEFAULTS={CLAUDE_MEM_MODEL:"claude-sonnet-4-5",CLAUDE_MEM_CONTEXT_OBSERVATIONS:"50",CLAUDE_MEM_WORKER_PORT:"37777",CLAUDE_MEM_WORKER_HOST:"127.0.0.1",CLAUDE_MEM_SKIP_TOOLS:"ListMcpResourcesTool,SlashCommand,Skill,TodoWrite,AskUserQuestion",CLAUDE_MEM_PROVIDER:"claude",CLAUDE_MEM_CLAUDE_AUTH_METHOD:"cli",CLAUDE_MEM_GEMINI_API_KEY:"",CLAUDE_MEM_GEMINI_MODEL:"gemini-2.5-flash-lite",CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED:"true",CLAUDE_MEM_OPENROUTER_API_KEY:"",CLAUDE_MEM_OPENROUTER_MODEL:"xiaomi/mimo-v2-flash:free",CLAUDE_MEM_OPENROUTER_SITE_URL:"",CLAUDE_MEM_OPENROUTER_APP_NAME:"claude-mem",CLAUDE_MEM_OPENROUTER_MAX_CONTEXT_MESSAGES:"20",CLAUDE_MEM_OPENROUTER_MAX_TOKENS:"100000",CLAUDE_MEM_DATA_DIR:(0,w.join)((0,de.homedir)(),".claude-mem"),CLAUDE_MEM_LOG_LEVEL:"INFO",CLAUDE_MEM_PYTHON_VERSION:"3.13",CLAUDE_CODE_PATH:"",CLAUDE_MEM_MODE:"code",CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS:"false",CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS:"false",CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT:"false",CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT:"true",CLAUDE_MEM_CONTEXT_OBSERVATION_TYPES:ie,CLAUDE_MEM_CONTEXT_OBSERVATION_CONCEPTS:ae,CLAUDE_MEM_CONTEXT_FULL_COUNT:"0",CLAUDE_MEM_CONTEXT_FULL_FIELD:"narrative",CLAUDE_MEM_CONTEXT_SESSION_COUNT:"10",CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY:"true",CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE:"false",CLAUDE_MEM_CONTEXT_SHOW_TERMINAL_OUTPUT:"true",CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED:"false",CLAUDE_MEM_MEMORY_MD_ENABLED:"false",CLAUDE_MEM_MAX_CONCURRENT_AGENTS:"2",CLAUDE_MEM_EXCLUDED_PROJECTS:"",CLAUDE_MEM_FOLDER_MD_EXCLUDE:"[]",CLAUDE_MEM_CHROMA_ENABLED:"true",CLAUDE_MEM_CHROMA_MODE:"local",CLAUDE_MEM_CHROMA_HOST:"127.0.0.1",CLAUDE_MEM_CHROMA_PORT:"8000",CLAUDE_MEM_CHROMA_SSL:"false",CLAUDE_MEM_CHROMA_API_KEY:"",CLAUDE_MEM_CHROMA_TENANT:"default_tenant",CLAUDE_MEM_CHROMA_DATABASE:"default_database"};static getAllDefaults(){return{...this.DEFAULTS}}static get(e){return this.DEFAULTS[e]}static getInt(e){let s=this.get(e);return parseInt(s,10)}static getBool(e){let s=this.get(e);return s==="true"||s===!0}static applyEnvOverrides(e){let s={...e};for(let t of Object.keys(this.DEFAULTS))process.env[t]!==void 0&&(s[t]=process.env[t]);return s}static loadFromFile(e){try{if(!(0,f.existsSync)(e)){let i=this.getAllDefaults();try{let a=(0,w.dirname)(e);(0,f.existsSync)(a)||(0,f.mkdirSync)(a,{recursive:!0}),(0,f.writeFileSync)(e,JSON.stringify(i,null,2),"utf-8"),console.log("[SETTINGS] Created settings file with defaults:",e)}catch(a){console.warn("[SETTINGS] Failed to create settings file, using in-memory defaults:",e,a)}return this.applyEnvOverrides(i)}let s=(0,f.readFileSync)(e,"utf-8"),t=JSON.parse(s),r=t;if(t.env&&typeof t.env=="object"){r=t.env;try{(0,f.writeFileSync)(e,JSON.stringify(r,null,2),"utf-8"),console.log("[SETTINGS] Migrated settings file from nested to flat schema:",e)}catch(i){console.warn("[SETTINGS] Failed to auto-migrate settings file:",e,i)}}let o={...this.DEFAULTS};for(let i of Object.keys(this.DEFAULTS))r[i]!==void 0&&(o[i]=r[i]);return this.applyEnvOverrides(o)}catch(s){return console.warn("[SETTINGS] Failed to load settings, using defaults:",e,s),this.applyEnvOverrides(this.getAllDefaults())}}};var C=require("fs"),M=require("path"),Ee=require("os"),V=(o=>(o[o.DEBUG=0]="DEBUG",o[o.INFO=1]="INFO",o[o.WARN=2]="WARN",o[o.ERROR=3]="ERROR",o[o.SILENT=4]="SILENT",o))(V||{}),_e=(0,M.join)((0,Ee.homedir)(),".claude-mem"),Y=class{level=null;useColor;logFilePath=null;logFileInitialized=!1;constructor(){this.useColor=process.stdout.isTTY??!1}ensureLogFileInitialized(){if(!this.logFileInitialized){this.logFileInitialized=!0;try{let e=(0,M.join)(_e,"logs");(0,C.existsSync)(e)||(0,C.mkdirSync)(e,{recursive:!0});let s=new Date().toISOString().split("T")[0];this.logFilePath=(0,M.join)(e,`claude-mem-${s}.log`)}catch(e){console.error("[LOGGER] Failed to initialize log file:",e),this.logFilePath=null}}}getLevel(){if(this.level===null)try{let e=(0,M.join)(_e,"settings.json");if((0,C.existsSync)(e)){let s=(0,C.readFileSync)(e,"utf-8"),r=(JSON.parse(s).CLAUDE_MEM_LOG_LEVEL||"INFO").toUpperCase();this.level=V[r]??1}else this.level=1}catch{this.level=1}return this.level}correlationId(e,s){return`obs-${e}-${s}`}sessionId(e){return`session-${e}`}formatData(e){if(e==null)return"";if(typeof e=="string")return e;if(typeof e=="number"||typeof e=="boolean")return e.toString();if(typeof e=="object"){if(e instanceof Error)return this.getLevel()===0?`${e.message}
${e.stack}`:e.message;if(Array.isArray(e))return`[${e.length} items]`;let s=Object.keys(e);return s.length===0?"{}":s.length<=3?JSON.stringify(e):`{${s.length} keys: ${s.slice(0,3).join(", ")}...}`}return String(e)}formatTool(e,s){if(!s)return e;let t=s;if(typeof s=="string")try{t=JSON.parse(s)}catch{t=s}if(e==="Bash"&&t.command)return`${e}(${t.command})`;if(t.file_path)return`${e}(${t.file_path})`;if(t.notebook_path)return`${e}(${t.notebook_path})`;if(e==="Glob"&&t.pattern)return`${e}(${t.pattern})`;if(e==="Grep"&&t.pattern)return`${e}(${t.pattern})`;if(t.url)return`${e}(${t.url})`;if(t.query)return`${e}(${t.query})`;if(e==="Task"){if(t.subagent_type)return`${e}(${t.subagent_type})`;if(t.description)return`${e}(${t.description})`}return e==="Skill"&&t.skill?`${e}(${t.skill})`:e==="LSP"&&t.operation?`${e}(${t.operation})`:e}formatTimestamp(e){let s=e.getFullYear(),t=String(e.getMonth()+1).padStart(2,"0"),r=String(e.getDate()).padStart(2,"0"),o=String(e.getHours()).padStart(2,"0"),i=String(e.getMinutes()).padStart(2,"0"),a=String(e.getSeconds()).padStart(2,"0"),d=String(e.getMilliseconds()).padStart(3,"0");return`${s}-${t}-${r} ${o}:${i}:${a}.${d}`}log(e,s,t,r,o){if(e<this.getLevel())return;this.ensureLogFileInitialized();let i=this.formatTimestamp(new Date),a=V[e].padEnd(5),d=s.padEnd(6),p="";r?.correlationId?p=`[${r.correlationId}] `:r?.sessionId&&(p=`[session-${r.sessionId}] `);let m="";o!=null&&(o instanceof Error?m=this.getLevel()===0?`
${o.message}
${o.stack}`:` ${o.message}`:this.getLevel()===0&&typeof o=="object"?m=`
`+JSON.stringify(o,null,2):m=" "+this.formatData(o));let l="";if(r){let{sessionId:T,memorySessionId:h,correlationId:g,...c}=r;Object.keys(c).length>0&&(l=` {${Object.entries(c).map(([N,R])=>`${N}=${R}`).join(", ")}}`)}let u=`[${i}] [${a}] [${d}] ${p}${t}${l}${m}`;if(this.logFilePath)try{(0,C.appendFileSync)(this.logFilePath,u+`
`,"utf8")}catch(T){process.stderr.write(`[LOGGER] Failed to write to log file: ${T}
`)}else process.stderr.write(u+`
`)}debug(e,s,t,r){this.log(0,e,s,t,r)}info(e,s,t,r){this.log(1,e,s,t,r)}warn(e,s,t,r){this.log(2,e,s,t,r)}error(e,s,t,r){this.log(3,e,s,t,r)}dataIn(e,s,t,r){this.info(e,`\u2192 ${s}`,t,r)}dataOut(e,s,t,r){this.info(e,`\u2190 ${s}`,t,r)}success(e,s,t,r){this.info(e,`\u2713 ${s}`,t,r)}failure(e,s,t,r){this.error(e,`\u2717 ${s}`,t,r)}timing(e,s,t,r){this.info(e,`\u23F1 ${s}`,r,{duration:`${t}ms`})}happyPathError(e,s,t,r,o=""){let p=((new Error().stack||"").split(`
`)[2]||"").match(/at\s+(?:.*\s+)?\(?([^:]+):(\d+):(\d+)\)?/),m=p?`${p[1].split("/").pop()}:${p[2]}`:"unknown",l={...t,location:m};return this.warn(e,`[HAPPY-PATH] ${s}`,l,r),o}},_=new Y;var Ls={};function Cs(){return typeof __dirname<"u"?__dirname:(0,S.dirname)((0,le.fileURLToPath)(Ls.url))}var As=Cs(),I=A.get("CLAUDE_MEM_DATA_DIR"),L=process.env.CLAUDE_CONFIG_DIR||(0,S.join)((0,pe.homedir)(),".claude"),zs=(0,S.join)(L,"plugins","marketplaces","thedotmack"),Js=(0,S.join)(I,"archives"),Qs=(0,S.join)(I,"logs"),Zs=(0,S.join)(I,"trash"),et=(0,S.join)(I,"backups"),st=(0,S.join)(I,"modes"),tt=(0,S.join)(I,"settings.json"),ue=(0,S.join)(I,"claude-mem.db"),rt=(0,S.join)(I,"vector-db"),nt=(0,S.join)(I,"observer-sessions"),ot=(0,S.join)(L,"settings.json"),it=(0,S.join)(L,"commands"),at=(0,S.join)(L,"CLAUDE.md");function ce(n){(0,me.mkdirSync)(n,{recursive:!0})}function Te(){return(0,S.join)(As,"..")}var ge=require("crypto");var vs=3e4;function Ne(n,e,s){return(0,ge.createHash)("sha256").update((n||"")+(e||"")+(s||"")).digest("hex").slice(0,16)}function he(n,e,s){let t=s-vs;return n.prepare("SELECT id, created_at_epoch FROM observations WHERE content_hash = ? AND created_at_epoch > ?").get(e,t)}var F=class{constructor(e){this.db=e}runAllMigrations(){this.initializeSchema(),this.ensureWorkerPortColumn(),this.ensurePromptTrackingColumns(),this.removeSessionSummariesUniqueConstraint(),this.addObservationHierarchicalFields(),this.makeObservationsTextNullable(),this.createUserPromptsTable(),this.ensureDiscoveryTokensColumn(),this.createPendingMessagesTable(),this.renameSessionIdColumns(),this.repairSessionIdColumnRename(),this.addFailedAtEpochColumn(),this.addOnUpdateCascadeToForeignKeys(),this.addObservationContentHashColumn(),this.addSessionCustomTitleColumn(),this.addSessionPlatformMetadataColumns(),this.createRawEventsTable(),this.addProjectionMetadataColumns(),this.addPendingMessageEventColumns(),this.createMemoryProjectionsTable(),this.createRetrievalFeedbackTable()}initializeSchema(){this.db.run(`
      CREATE TABLE IF NOT EXISTS schema_versions (
        id INTEGER PRIMARY KEY,
        version INTEGER UNIQUE NOT NULL,
        applied_at TEXT NOT NULL
      )
    `),this.db.run(`
      CREATE TABLE IF NOT EXISTS sdk_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_session_id TEXT UNIQUE NOT NULL,
        memory_session_id TEXT UNIQUE,
        project TEXT NOT NULL,
        user_prompt TEXT,
        started_at TEXT NOT NULL,
        started_at_epoch INTEGER NOT NULL,
        completed_at TEXT,
        completed_at_epoch INTEGER,
        status TEXT CHECK(status IN ('active', 'completed', 'failed')) NOT NULL DEFAULT 'active'
      );

      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_claude_id ON sdk_sessions(content_session_id);
      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_sdk_id ON sdk_sessions(memory_session_id);
      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_project ON sdk_sessions(project);
      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_status ON sdk_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_started ON sdk_sessions(started_at_epoch DESC);

      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        text TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_observations_sdk_session ON observations(memory_session_id);
      CREATE INDEX IF NOT EXISTS idx_observations_project ON observations(project);
      CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type);
      CREATE INDEX IF NOT EXISTS idx_observations_created ON observations(created_at_epoch DESC);

      CREATE TABLE IF NOT EXISTS session_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT UNIQUE NOT NULL,
        project TEXT NOT NULL,
        request TEXT,
        investigated TEXT,
        learned TEXT,
        completed TEXT,
        next_steps TEXT,
        files_read TEXT,
        files_edited TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_session_summaries_sdk_session ON session_summaries(memory_session_id);
      CREATE INDEX IF NOT EXISTS idx_session_summaries_project ON session_summaries(project);
      CREATE INDEX IF NOT EXISTS idx_session_summaries_created ON session_summaries(created_at_epoch DESC);
    `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(4,new Date().toISOString())}ensureWorkerPortColumn(){this.db.query("PRAGMA table_info(sdk_sessions)").all().some(t=>t.name==="worker_port")||(this.db.run("ALTER TABLE sdk_sessions ADD COLUMN worker_port INTEGER"),_.debug("DB","Added worker_port column to sdk_sessions table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(5,new Date().toISOString())}ensurePromptTrackingColumns(){this.db.query("PRAGMA table_info(sdk_sessions)").all().some(a=>a.name==="prompt_counter")||(this.db.run("ALTER TABLE sdk_sessions ADD COLUMN prompt_counter INTEGER DEFAULT 0"),_.debug("DB","Added prompt_counter column to sdk_sessions table")),this.db.query("PRAGMA table_info(observations)").all().some(a=>a.name==="prompt_number")||(this.db.run("ALTER TABLE observations ADD COLUMN prompt_number INTEGER"),_.debug("DB","Added prompt_number column to observations table")),this.db.query("PRAGMA table_info(session_summaries)").all().some(a=>a.name==="prompt_number")||(this.db.run("ALTER TABLE session_summaries ADD COLUMN prompt_number INTEGER"),_.debug("DB","Added prompt_number column to session_summaries table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(6,new Date().toISOString())}removeSessionSummariesUniqueConstraint(){if(!this.db.query("PRAGMA index_list(session_summaries)").all().some(t=>t.unique===1)){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(7,new Date().toISOString());return}_.debug("DB","Removing UNIQUE constraint from session_summaries.memory_session_id"),this.db.run("BEGIN TRANSACTION"),this.db.run("DROP TABLE IF EXISTS session_summaries_new"),this.db.run(`
      CREATE TABLE session_summaries_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        request TEXT,
        investigated TEXT,
        learned TEXT,
        completed TEXT,
        next_steps TEXT,
        files_read TEXT,
        files_edited TEXT,
        notes TEXT,
        prompt_number INTEGER,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE
      )
    `),this.db.run(`
      INSERT INTO session_summaries_new
      SELECT id, memory_session_id, project, request, investigated, learned,
             completed, next_steps, files_read, files_edited, notes,
             prompt_number, created_at, created_at_epoch
      FROM session_summaries
    `),this.db.run("DROP TABLE session_summaries"),this.db.run("ALTER TABLE session_summaries_new RENAME TO session_summaries"),this.db.run(`
      CREATE INDEX idx_session_summaries_sdk_session ON session_summaries(memory_session_id);
      CREATE INDEX idx_session_summaries_project ON session_summaries(project);
      CREATE INDEX idx_session_summaries_created ON session_summaries(created_at_epoch DESC);
    `),this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(7,new Date().toISOString()),_.debug("DB","Successfully removed UNIQUE constraint from session_summaries.memory_session_id")}addObservationHierarchicalFields(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(8))return;if(this.db.query("PRAGMA table_info(observations)").all().some(r=>r.name==="title")){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(8,new Date().toISOString());return}_.debug("DB","Adding hierarchical fields to observations table"),this.db.run(`
      ALTER TABLE observations ADD COLUMN title TEXT;
      ALTER TABLE observations ADD COLUMN subtitle TEXT;
      ALTER TABLE observations ADD COLUMN facts TEXT;
      ALTER TABLE observations ADD COLUMN narrative TEXT;
      ALTER TABLE observations ADD COLUMN concepts TEXT;
      ALTER TABLE observations ADD COLUMN files_read TEXT;
      ALTER TABLE observations ADD COLUMN files_modified TEXT;
    `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(8,new Date().toISOString()),_.debug("DB","Successfully added hierarchical fields to observations table")}makeObservationsTextNullable(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(9))return;let t=this.db.query("PRAGMA table_info(observations)").all().find(r=>r.name==="text");if(!t||t.notnull===0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(9,new Date().toISOString());return}_.debug("DB","Making observations.text nullable"),this.db.run("BEGIN TRANSACTION"),this.db.run("DROP TABLE IF EXISTS observations_new"),this.db.run(`
      CREATE TABLE observations_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        text TEXT,
        type TEXT NOT NULL,
        title TEXT,
        subtitle TEXT,
        facts TEXT,
        narrative TEXT,
        concepts TEXT,
        files_read TEXT,
        files_modified TEXT,
        prompt_number INTEGER,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE
      )
    `),this.db.run(`
      INSERT INTO observations_new
      SELECT id, memory_session_id, project, text, type, title, subtitle, facts,
             narrative, concepts, files_read, files_modified, prompt_number,
             created_at, created_at_epoch
      FROM observations
    `),this.db.run("DROP TABLE observations"),this.db.run("ALTER TABLE observations_new RENAME TO observations"),this.db.run(`
      CREATE INDEX idx_observations_sdk_session ON observations(memory_session_id);
      CREATE INDEX idx_observations_project ON observations(project);
      CREATE INDEX idx_observations_type ON observations(type);
      CREATE INDEX idx_observations_created ON observations(created_at_epoch DESC);
    `),this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(9,new Date().toISOString()),_.debug("DB","Successfully made observations.text nullable")}createUserPromptsTable(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(10))return;if(this.db.query("PRAGMA table_info(user_prompts)").all().length>0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(10,new Date().toISOString());return}_.debug("DB","Creating user_prompts table with FTS5 support"),this.db.run("BEGIN TRANSACTION"),this.db.run(`
      CREATE TABLE user_prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_session_id TEXT NOT NULL,
        prompt_number INTEGER NOT NULL,
        prompt_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(content_session_id) REFERENCES sdk_sessions(content_session_id) ON DELETE CASCADE
      );

      CREATE INDEX idx_user_prompts_claude_session ON user_prompts(content_session_id);
      CREATE INDEX idx_user_prompts_created ON user_prompts(created_at_epoch DESC);
      CREATE INDEX idx_user_prompts_prompt_number ON user_prompts(prompt_number);
      CREATE INDEX idx_user_prompts_lookup ON user_prompts(content_session_id, prompt_number);
    `);try{this.db.run(`
        CREATE VIRTUAL TABLE user_prompts_fts USING fts5(
          prompt_text,
          content='user_prompts',
          content_rowid='id'
        );
      `),this.db.run(`
        CREATE TRIGGER user_prompts_ai AFTER INSERT ON user_prompts BEGIN
          INSERT INTO user_prompts_fts(rowid, prompt_text)
          VALUES (new.id, new.prompt_text);
        END;

        CREATE TRIGGER user_prompts_ad AFTER DELETE ON user_prompts BEGIN
          INSERT INTO user_prompts_fts(user_prompts_fts, rowid, prompt_text)
          VALUES('delete', old.id, old.prompt_text);
        END;

        CREATE TRIGGER user_prompts_au AFTER UPDATE ON user_prompts BEGIN
          INSERT INTO user_prompts_fts(user_prompts_fts, rowid, prompt_text)
          VALUES('delete', old.id, old.prompt_text);
          INSERT INTO user_prompts_fts(rowid, prompt_text)
          VALUES (new.id, new.prompt_text);
        END;
      `)}catch(t){_.warn("DB","FTS5 not available \u2014 user_prompts_fts skipped (search uses ChromaDB)",{},t)}this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(10,new Date().toISOString()),_.debug("DB","Successfully created user_prompts table")}ensureDiscoveryTokensColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(11))return;this.db.query("PRAGMA table_info(observations)").all().some(i=>i.name==="discovery_tokens")||(this.db.run("ALTER TABLE observations ADD COLUMN discovery_tokens INTEGER DEFAULT 0"),_.debug("DB","Added discovery_tokens column to observations table")),this.db.query("PRAGMA table_info(session_summaries)").all().some(i=>i.name==="discovery_tokens")||(this.db.run("ALTER TABLE session_summaries ADD COLUMN discovery_tokens INTEGER DEFAULT 0"),_.debug("DB","Added discovery_tokens column to session_summaries table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(11,new Date().toISOString())}createPendingMessagesTable(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(16))return;if(this.db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='pending_messages'").all().length>0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(16,new Date().toISOString());return}_.debug("DB","Creating pending_messages table"),this.db.run(`
      CREATE TABLE pending_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_db_id INTEGER NOT NULL,
        content_session_id TEXT NOT NULL,
        message_type TEXT NOT NULL CHECK(message_type IN ('observation', 'summarize')),
        tool_name TEXT,
        tool_input TEXT,
        tool_response TEXT,
        cwd TEXT,
        last_user_message TEXT,
        last_assistant_message TEXT,
        prompt_number INTEGER,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'processed', 'failed')),
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at_epoch INTEGER NOT NULL,
        started_processing_at_epoch INTEGER,
        completed_at_epoch INTEGER,
        FOREIGN KEY (session_db_id) REFERENCES sdk_sessions(id) ON DELETE CASCADE
      )
    `),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_session ON pending_messages(session_db_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_status ON pending_messages(status)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_claude_session ON pending_messages(content_session_id)"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(16,new Date().toISOString()),_.debug("DB","pending_messages table created successfully")}renameSessionIdColumns(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(17))return;_.debug("DB","Checking session ID columns for semantic clarity rename");let s=0,t=(r,o,i)=>{let a=this.db.query(`PRAGMA table_info(${r})`).all(),d=a.some(m=>m.name===o);return a.some(m=>m.name===i)?!1:d?(this.db.run(`ALTER TABLE ${r} RENAME COLUMN ${o} TO ${i}`),_.debug("DB",`Renamed ${r}.${o} to ${i}`),!0):(_.warn("DB",`Column ${o} not found in ${r}, skipping rename`),!1)};t("sdk_sessions","claude_session_id","content_session_id")&&s++,t("sdk_sessions","sdk_session_id","memory_session_id")&&s++,t("pending_messages","claude_session_id","content_session_id")&&s++,t("observations","sdk_session_id","memory_session_id")&&s++,t("session_summaries","sdk_session_id","memory_session_id")&&s++,t("user_prompts","claude_session_id","content_session_id")&&s++,this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(17,new Date().toISOString()),s>0?_.debug("DB",`Successfully renamed ${s} session ID columns`):_.debug("DB","No session ID column renames needed (already up to date)")}repairSessionIdColumnRename(){this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(19)||this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(19,new Date().toISOString())}addFailedAtEpochColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(20))return;this.db.query("PRAGMA table_info(pending_messages)").all().some(r=>r.name==="failed_at_epoch")||(this.db.run("ALTER TABLE pending_messages ADD COLUMN failed_at_epoch INTEGER"),_.debug("DB","Added failed_at_epoch column to pending_messages table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(20,new Date().toISOString())}addOnUpdateCascadeToForeignKeys(){if(!this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(21)){_.debug("DB","Adding ON UPDATE CASCADE to FK constraints on observations and session_summaries"),this.db.run("PRAGMA foreign_keys = OFF"),this.db.run("BEGIN TRANSACTION");try{this.db.run("DROP TRIGGER IF EXISTS observations_ai"),this.db.run("DROP TRIGGER IF EXISTS observations_ad"),this.db.run("DROP TRIGGER IF EXISTS observations_au"),this.db.run("DROP TABLE IF EXISTS observations_new"),this.db.run(`
        CREATE TABLE observations_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memory_session_id TEXT NOT NULL,
          project TEXT NOT NULL,
          text TEXT,
          type TEXT NOT NULL,
          title TEXT,
          subtitle TEXT,
          facts TEXT,
          narrative TEXT,
          concepts TEXT,
          files_read TEXT,
          files_modified TEXT,
          prompt_number INTEGER,
          discovery_tokens INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          created_at_epoch INTEGER NOT NULL,
          FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE
        )
      `),this.db.run(`
        INSERT INTO observations_new
        SELECT id, memory_session_id, project, text, type, title, subtitle, facts,
               narrative, concepts, files_read, files_modified, prompt_number,
               discovery_tokens, created_at, created_at_epoch
        FROM observations
      `),this.db.run("DROP TABLE observations"),this.db.run("ALTER TABLE observations_new RENAME TO observations"),this.db.run(`
        CREATE INDEX idx_observations_sdk_session ON observations(memory_session_id);
        CREATE INDEX idx_observations_project ON observations(project);
        CREATE INDEX idx_observations_type ON observations(type);
        CREATE INDEX idx_observations_created ON observations(created_at_epoch DESC);
      `),this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='observations_fts'").all().length>0&&this.db.run(`
          CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
            INSERT INTO observations_fts(rowid, title, subtitle, narrative, text, facts, concepts)
            VALUES (new.id, new.title, new.subtitle, new.narrative, new.text, new.facts, new.concepts);
          END;

          CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
            INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, text, facts, concepts)
            VALUES('delete', old.id, old.title, old.subtitle, old.narrative, old.text, old.facts, old.concepts);
          END;

          CREATE TRIGGER IF NOT EXISTS observations_au AFTER UPDATE ON observations BEGIN
            INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, text, facts, concepts)
            VALUES('delete', old.id, old.title, old.subtitle, old.narrative, old.text, old.facts, old.concepts);
            INSERT INTO observations_fts(rowid, title, subtitle, narrative, text, facts, concepts)
            VALUES (new.id, new.title, new.subtitle, new.narrative, new.text, new.facts, new.concepts);
          END;
        `),this.db.run("DROP TABLE IF EXISTS session_summaries_new"),this.db.run(`
        CREATE TABLE session_summaries_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memory_session_id TEXT NOT NULL,
          project TEXT NOT NULL,
          request TEXT,
          investigated TEXT,
          learned TEXT,
          completed TEXT,
          next_steps TEXT,
          files_read TEXT,
          files_edited TEXT,
          notes TEXT,
          prompt_number INTEGER,
          discovery_tokens INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          created_at_epoch INTEGER NOT NULL,
          FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE
        )
      `),this.db.run(`
        INSERT INTO session_summaries_new
        SELECT id, memory_session_id, project, request, investigated, learned,
               completed, next_steps, files_read, files_edited, notes,
               prompt_number, discovery_tokens, created_at, created_at_epoch
        FROM session_summaries
      `),this.db.run("DROP TRIGGER IF EXISTS session_summaries_ai"),this.db.run("DROP TRIGGER IF EXISTS session_summaries_ad"),this.db.run("DROP TRIGGER IF EXISTS session_summaries_au"),this.db.run("DROP TABLE session_summaries"),this.db.run("ALTER TABLE session_summaries_new RENAME TO session_summaries"),this.db.run(`
        CREATE INDEX idx_session_summaries_sdk_session ON session_summaries(memory_session_id);
        CREATE INDEX idx_session_summaries_project ON session_summaries(project);
        CREATE INDEX idx_session_summaries_created ON session_summaries(created_at_epoch DESC);
      `),this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_summaries_fts'").all().length>0&&this.db.run(`
          CREATE TRIGGER IF NOT EXISTS session_summaries_ai AFTER INSERT ON session_summaries BEGIN
            INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps, notes)
            VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps, new.notes);
          END;

          CREATE TRIGGER IF NOT EXISTS session_summaries_ad AFTER DELETE ON session_summaries BEGIN
            INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps, notes)
            VALUES('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps, old.notes);
          END;

          CREATE TRIGGER IF NOT EXISTS session_summaries_au AFTER UPDATE ON session_summaries BEGIN
            INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps, notes)
            VALUES('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps, old.notes);
            INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps, notes)
            VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps, new.notes);
          END;
        `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(21,new Date().toISOString()),this.db.run("COMMIT"),this.db.run("PRAGMA foreign_keys = ON"),_.debug("DB","Successfully added ON UPDATE CASCADE to FK constraints")}catch(s){throw this.db.run("ROLLBACK"),this.db.run("PRAGMA foreign_keys = ON"),s}}}addObservationContentHashColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(22))return;this.db.query("PRAGMA table_info(observations)").all().some(r=>r.name==="content_hash")||(this.db.run("ALTER TABLE observations ADD COLUMN content_hash TEXT"),this.db.run("UPDATE observations SET content_hash = substr(hex(randomblob(8)), 1, 16) WHERE content_hash IS NULL"),this.db.run("CREATE INDEX IF NOT EXISTS idx_observations_content_hash ON observations(content_hash, created_at_epoch)"),_.debug("DB","Added content_hash column to observations table with backfill and index")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(22,new Date().toISOString())}addSessionCustomTitleColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(23))return;this.db.query("PRAGMA table_info(sdk_sessions)").all().some(r=>r.name==="custom_title")||(this.db.run("ALTER TABLE sdk_sessions ADD COLUMN custom_title TEXT"),_.debug("DB","Added custom_title column to sdk_sessions table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(23,new Date().toISOString())}addSessionPlatformMetadataColumns(){this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(24)||(this.ensureColumn("sdk_sessions","platform","TEXT NOT NULL DEFAULT 'claude'"),this.ensureColumn("sdk_sessions","client_kind","TEXT NOT NULL DEFAULT 'claude-code'"),this.ensureColumn("sdk_sessions","capture_mode","TEXT NOT NULL DEFAULT 'hook'"),this.ensureColumn("sdk_sessions","platform_session_id","TEXT"),this.ensureColumn("sdk_sessions","parent_session_id","TEXT"),this.ensureColumn("sdk_sessions","agent_role","TEXT"),this.ensureColumn("sdk_sessions","repo_root","TEXT"),this.ensureColumn("sdk_sessions","repo_id","TEXT"),this.ensureColumn("sdk_sessions","git_branch","TEXT"),this.ensureColumn("sdk_sessions","git_commit","TEXT"),this.db.run(`
      UPDATE sdk_sessions
      SET platform_session_id = content_session_id
      WHERE platform_session_id IS NULL OR platform_session_id = ''
    `),this.db.run("CREATE INDEX IF NOT EXISTS idx_sdk_sessions_platform ON sdk_sessions(platform)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_sdk_sessions_platform_session ON sdk_sessions(platform_session_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_sdk_sessions_parent_session ON sdk_sessions(parent_session_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_sdk_sessions_repo_id ON sdk_sessions(repo_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_sdk_sessions_git_branch ON sdk_sessions(git_branch)"),this.recordMigration(24))}createRawEventsTable(){this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(25)||(this.db.run(`
      CREATE TABLE IF NOT EXISTS raw_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_uuid TEXT UNIQUE NOT NULL,
        platform TEXT NOT NULL,
        client_kind TEXT NOT NULL,
        capture_mode TEXT NOT NULL,
        platform_session_id TEXT NOT NULL,
        platform_turn_id TEXT,
        item_id TEXT,
        parent_session_id TEXT,
        agent_role TEXT,
        event_type TEXT NOT NULL,
        cwd TEXT,
        project TEXT,
        repo_root TEXT,
        repo_id TEXT,
        git_branch TEXT,
        git_commit TEXT,
        payload_json TEXT NOT NULL,
        payload_hash TEXT UNIQUE NOT NULL,
        privacy_state TEXT NOT NULL DEFAULT 'normal',
        source_confidence TEXT NOT NULL DEFAULT 'high',
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        session_db_id INTEGER,
        FOREIGN KEY(session_db_id) REFERENCES sdk_sessions(id) ON DELETE SET NULL
      )
    `),this.db.run("CREATE INDEX IF NOT EXISTS idx_raw_events_platform_session ON raw_events(platform_session_id, created_at_epoch DESC)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_raw_events_turn ON raw_events(platform_turn_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_raw_events_parent_session ON raw_events(parent_session_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_raw_events_event_type ON raw_events(event_type)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_raw_events_repo_id ON raw_events(repo_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_raw_events_created ON raw_events(created_at_epoch DESC)"),this.recordMigration(25))}addProjectionMetadataColumns(){this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(26)||(this.ensureColumn("observations","uuid","TEXT"),this.ensureColumn("observations","platform","TEXT NOT NULL DEFAULT 'claude'"),this.ensureColumn("observations","client_kind","TEXT NOT NULL DEFAULT 'claude-code'"),this.ensureColumn("observations","capture_mode","TEXT NOT NULL DEFAULT 'hook'"),this.ensureColumn("observations","capture_fidelity","TEXT NOT NULL DEFAULT 'high'"),this.ensureColumn("observations","raw_event_id","INTEGER"),this.ensureColumn("observations","platform_session_id","TEXT"),this.ensureColumn("observations","platform_turn_id","TEXT"),this.ensureColumn("observations","repo_root","TEXT"),this.ensureColumn("observations","repo_id","TEXT"),this.ensureColumn("observations","git_branch","TEXT"),this.ensureColumn("observations","git_commit","TEXT"),this.ensureColumn("observations","parent_session_id","TEXT"),this.ensureColumn("observations","agent_role","TEXT"),this.ensureColumn("observations","superseded_by","INTEGER"),this.ensureColumn("observations","staleness_score","REAL NOT NULL DEFAULT 0"),this.ensureColumn("session_summaries","uuid","TEXT"),this.ensureColumn("session_summaries","platform","TEXT NOT NULL DEFAULT 'claude'"),this.ensureColumn("session_summaries","client_kind","TEXT NOT NULL DEFAULT 'claude-code'"),this.ensureColumn("session_summaries","capture_mode","TEXT NOT NULL DEFAULT 'hook'"),this.ensureColumn("session_summaries","capture_fidelity","TEXT NOT NULL DEFAULT 'high'"),this.ensureColumn("session_summaries","raw_event_id","INTEGER"),this.ensureColumn("session_summaries","platform_session_id","TEXT"),this.ensureColumn("session_summaries","platform_turn_id","TEXT"),this.ensureColumn("session_summaries","repo_root","TEXT"),this.ensureColumn("session_summaries","repo_id","TEXT"),this.ensureColumn("session_summaries","git_branch","TEXT"),this.ensureColumn("session_summaries","git_commit","TEXT"),this.ensureColumn("session_summaries","parent_session_id","TEXT"),this.ensureColumn("session_summaries","agent_role","TEXT"),this.ensureColumn("session_summaries","superseded_by","INTEGER"),this.ensureColumn("session_summaries","staleness_score","REAL NOT NULL DEFAULT 0"),this.ensureColumn("user_prompts","platform","TEXT NOT NULL DEFAULT 'claude'"),this.ensureColumn("user_prompts","client_kind","TEXT NOT NULL DEFAULT 'claude-code'"),this.ensureColumn("user_prompts","capture_mode","TEXT NOT NULL DEFAULT 'hook'"),this.ensureColumn("user_prompts","platform_turn_id","TEXT"),this.ensureColumn("user_prompts","raw_event_id","INTEGER"),this.ensureColumn("user_prompts","repo_root","TEXT"),this.ensureColumn("user_prompts","repo_id","TEXT"),this.ensureColumn("user_prompts","git_branch","TEXT"),this.ensureColumn("user_prompts","git_commit","TEXT"),this.ensureColumn("user_prompts","parent_session_id","TEXT"),this.ensureColumn("user_prompts","agent_role","TEXT"),this.db.run(`
      UPDATE observations
      SET
        platform = COALESCE(platform, (SELECT s.platform FROM sdk_sessions s WHERE s.memory_session_id = observations.memory_session_id)),
        client_kind = COALESCE(client_kind, (SELECT s.client_kind FROM sdk_sessions s WHERE s.memory_session_id = observations.memory_session_id)),
        capture_mode = COALESCE(capture_mode, (SELECT s.capture_mode FROM sdk_sessions s WHERE s.memory_session_id = observations.memory_session_id)),
        platform_session_id = COALESCE(platform_session_id, (SELECT s.platform_session_id FROM sdk_sessions s WHERE s.memory_session_id = observations.memory_session_id)),
        repo_root = COALESCE(repo_root, (SELECT s.repo_root FROM sdk_sessions s WHERE s.memory_session_id = observations.memory_session_id)),
        repo_id = COALESCE(repo_id, (SELECT s.repo_id FROM sdk_sessions s WHERE s.memory_session_id = observations.memory_session_id)),
        git_branch = COALESCE(git_branch, (SELECT s.git_branch FROM sdk_sessions s WHERE s.memory_session_id = observations.memory_session_id)),
        git_commit = COALESCE(git_commit, (SELECT s.git_commit FROM sdk_sessions s WHERE s.memory_session_id = observations.memory_session_id)),
        parent_session_id = COALESCE(parent_session_id, (SELECT s.parent_session_id FROM sdk_sessions s WHERE s.memory_session_id = observations.memory_session_id)),
        agent_role = COALESCE(agent_role, (SELECT s.agent_role FROM sdk_sessions s WHERE s.memory_session_id = observations.memory_session_id))
    `),this.db.run(`
      UPDATE session_summaries
      SET
        platform = COALESCE(platform, (SELECT s.platform FROM sdk_sessions s WHERE s.memory_session_id = session_summaries.memory_session_id)),
        client_kind = COALESCE(client_kind, (SELECT s.client_kind FROM sdk_sessions s WHERE s.memory_session_id = session_summaries.memory_session_id)),
        capture_mode = COALESCE(capture_mode, (SELECT s.capture_mode FROM sdk_sessions s WHERE s.memory_session_id = session_summaries.memory_session_id)),
        platform_session_id = COALESCE(platform_session_id, (SELECT s.platform_session_id FROM sdk_sessions s WHERE s.memory_session_id = session_summaries.memory_session_id)),
        repo_root = COALESCE(repo_root, (SELECT s.repo_root FROM sdk_sessions s WHERE s.memory_session_id = session_summaries.memory_session_id)),
        repo_id = COALESCE(repo_id, (SELECT s.repo_id FROM sdk_sessions s WHERE s.memory_session_id = session_summaries.memory_session_id)),
        git_branch = COALESCE(git_branch, (SELECT s.git_branch FROM sdk_sessions s WHERE s.memory_session_id = session_summaries.memory_session_id)),
        git_commit = COALESCE(git_commit, (SELECT s.git_commit FROM sdk_sessions s WHERE s.memory_session_id = session_summaries.memory_session_id)),
        parent_session_id = COALESCE(parent_session_id, (SELECT s.parent_session_id FROM sdk_sessions s WHERE s.memory_session_id = session_summaries.memory_session_id)),
        agent_role = COALESCE(agent_role, (SELECT s.agent_role FROM sdk_sessions s WHERE s.memory_session_id = session_summaries.memory_session_id))
    `),this.db.run(`
      UPDATE user_prompts
      SET
        platform = COALESCE(platform, (SELECT s.platform FROM sdk_sessions s WHERE s.content_session_id = user_prompts.content_session_id)),
        client_kind = COALESCE(client_kind, (SELECT s.client_kind FROM sdk_sessions s WHERE s.content_session_id = user_prompts.content_session_id)),
        capture_mode = COALESCE(capture_mode, (SELECT s.capture_mode FROM sdk_sessions s WHERE s.content_session_id = user_prompts.content_session_id)),
        repo_root = COALESCE(repo_root, (SELECT s.repo_root FROM sdk_sessions s WHERE s.content_session_id = user_prompts.content_session_id)),
        repo_id = COALESCE(repo_id, (SELECT s.repo_id FROM sdk_sessions s WHERE s.content_session_id = user_prompts.content_session_id)),
        git_branch = COALESCE(git_branch, (SELECT s.git_branch FROM sdk_sessions s WHERE s.content_session_id = user_prompts.content_session_id)),
        git_commit = COALESCE(git_commit, (SELECT s.git_commit FROM sdk_sessions s WHERE s.content_session_id = user_prompts.content_session_id)),
        parent_session_id = COALESCE(parent_session_id, (SELECT s.parent_session_id FROM sdk_sessions s WHERE s.content_session_id = user_prompts.content_session_id)),
        agent_role = COALESCE(agent_role, (SELECT s.agent_role FROM sdk_sessions s WHERE s.content_session_id = user_prompts.content_session_id))
    `),this.db.run("CREATE INDEX IF NOT EXISTS idx_observations_platform ON observations(platform)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_observations_raw_event_id ON observations(raw_event_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_session_summaries_platform ON session_summaries(platform)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_session_summaries_raw_event_id ON session_summaries(raw_event_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_user_prompts_platform ON user_prompts(platform)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_user_prompts_raw_event_id ON user_prompts(raw_event_id)"),this.recordMigration(26))}addPendingMessageEventColumns(){this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(27)||(this.ensureColumn("pending_messages","raw_event_id","INTEGER"),this.ensureColumn("pending_messages","platform","TEXT NOT NULL DEFAULT 'claude'"),this.ensureColumn("pending_messages","client_kind","TEXT NOT NULL DEFAULT 'claude-code'"),this.ensureColumn("pending_messages","capture_mode","TEXT NOT NULL DEFAULT 'hook'"),this.ensureColumn("pending_messages","platform_turn_id","TEXT"),this.ensureColumn("pending_messages","repo_root","TEXT"),this.ensureColumn("pending_messages","repo_id","TEXT"),this.ensureColumn("pending_messages","git_branch","TEXT"),this.ensureColumn("pending_messages","git_commit","TEXT"),this.ensureColumn("pending_messages","parent_session_id","TEXT"),this.ensureColumn("pending_messages","agent_role","TEXT"),this.db.run(`
      UPDATE pending_messages
      SET
        platform = COALESCE(platform, (SELECT s.platform FROM sdk_sessions s WHERE s.id = pending_messages.session_db_id)),
        client_kind = COALESCE(client_kind, (SELECT s.client_kind FROM sdk_sessions s WHERE s.id = pending_messages.session_db_id)),
        capture_mode = COALESCE(capture_mode, (SELECT s.capture_mode FROM sdk_sessions s WHERE s.id = pending_messages.session_db_id)),
        repo_root = COALESCE(repo_root, (SELECT s.repo_root FROM sdk_sessions s WHERE s.id = pending_messages.session_db_id)),
        repo_id = COALESCE(repo_id, (SELECT s.repo_id FROM sdk_sessions s WHERE s.id = pending_messages.session_db_id)),
        git_branch = COALESCE(git_branch, (SELECT s.git_branch FROM sdk_sessions s WHERE s.id = pending_messages.session_db_id)),
        git_commit = COALESCE(git_commit, (SELECT s.git_commit FROM sdk_sessions s WHERE s.id = pending_messages.session_db_id)),
        parent_session_id = COALESCE(parent_session_id, (SELECT s.parent_session_id FROM sdk_sessions s WHERE s.id = pending_messages.session_db_id)),
        agent_role = COALESCE(agent_role, (SELECT s.agent_role FROM sdk_sessions s WHERE s.id = pending_messages.session_db_id))
    `),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_raw_event_id ON pending_messages(raw_event_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_platform ON pending_messages(platform)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_repo_id ON pending_messages(repo_id)"),this.recordMigration(27))}createMemoryProjectionsTable(){this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(28)||(this.db.run(`
      CREATE TABLE IF NOT EXISTS memory_projections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id TEXT,
        repo_root TEXT,
        project TEXT NOT NULL,
        projection_type TEXT NOT NULL,
        target_path TEXT NOT NULL,
        content TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        generated_at_epoch INTEGER NOT NULL,
        raw_event_id INTEGER,
        UNIQUE(projection_type, target_path),
        FOREIGN KEY(raw_event_id) REFERENCES raw_events(id) ON DELETE SET NULL
      )
    `),this.db.run("CREATE INDEX IF NOT EXISTS idx_memory_projections_repo_id ON memory_projections(repo_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_memory_projections_project ON memory_projections(project)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_memory_projections_generated ON memory_projections(generated_at_epoch DESC)"),this.recordMigration(28))}createRetrievalFeedbackTable(){this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(29)||(this.db.run(`
      CREATE TABLE IF NOT EXISTS retrieval_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        observation_id INTEGER,
        raw_event_id INTEGER,
        content_session_id TEXT,
        platform TEXT,
        client_kind TEXT,
        tool_name TEXT,
        query_text TEXT,
        feedback_label TEXT,
        feedback_score REAL,
        notes TEXT,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(observation_id) REFERENCES observations(id) ON DELETE SET NULL,
        FOREIGN KEY(raw_event_id) REFERENCES raw_events(id) ON DELETE SET NULL,
        FOREIGN KEY(content_session_id) REFERENCES sdk_sessions(content_session_id) ON DELETE SET NULL
      )
    `),this.db.run("CREATE INDEX IF NOT EXISTS idx_retrieval_feedback_observation ON retrieval_feedback(observation_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_retrieval_feedback_session ON retrieval_feedback(content_session_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_retrieval_feedback_created ON retrieval_feedback(created_at_epoch DESC)"),this.recordMigration(29))}ensureColumn(e,s,t){this.db.query(`PRAGMA table_info(${e})`).all().some(i=>i.name===s)||(this.db.run(`ALTER TABLE ${e} ADD COLUMN ${s} ${t}`),_.debug("DB",`Added ${s} column to ${e}`))}recordMigration(e){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(e,new Date().toISOString())}};var P=class{db;constructor(e=ue){e!==":memory:"&&ce(I),this.db=new Se.Database(e),this.db.run("PRAGMA journal_mode = WAL"),this.db.run("PRAGMA synchronous = NORMAL"),this.db.run("PRAGMA foreign_keys = ON"),new F(this.db).runAllMigrations()}initializeSchema(){this.db.run(`
      CREATE TABLE IF NOT EXISTS schema_versions (
        id INTEGER PRIMARY KEY,
        version INTEGER UNIQUE NOT NULL,
        applied_at TEXT NOT NULL
      )
    `),this.db.run(`
      CREATE TABLE IF NOT EXISTS sdk_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_session_id TEXT UNIQUE NOT NULL,
        memory_session_id TEXT UNIQUE,
        project TEXT NOT NULL,
        user_prompt TEXT,
        started_at TEXT NOT NULL,
        started_at_epoch INTEGER NOT NULL,
        completed_at TEXT,
        completed_at_epoch INTEGER,
        status TEXT CHECK(status IN ('active', 'completed', 'failed')) NOT NULL DEFAULT 'active'
      );

      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_claude_id ON sdk_sessions(content_session_id);
      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_sdk_id ON sdk_sessions(memory_session_id);
      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_project ON sdk_sessions(project);
      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_status ON sdk_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sdk_sessions_started ON sdk_sessions(started_at_epoch DESC);

      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        text TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_observations_sdk_session ON observations(memory_session_id);
      CREATE INDEX IF NOT EXISTS idx_observations_project ON observations(project);
      CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type);
      CREATE INDEX IF NOT EXISTS idx_observations_created ON observations(created_at_epoch DESC);

      CREATE TABLE IF NOT EXISTS session_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT UNIQUE NOT NULL,
        project TEXT NOT NULL,
        request TEXT,
        investigated TEXT,
        learned TEXT,
        completed TEXT,
        next_steps TEXT,
        files_read TEXT,
        files_edited TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_session_summaries_sdk_session ON session_summaries(memory_session_id);
      CREATE INDEX IF NOT EXISTS idx_session_summaries_project ON session_summaries(project);
      CREATE INDEX IF NOT EXISTS idx_session_summaries_created ON session_summaries(created_at_epoch DESC);
    `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(4,new Date().toISOString())}ensureWorkerPortColumn(){this.db.query("PRAGMA table_info(sdk_sessions)").all().some(t=>t.name==="worker_port")||(this.db.run("ALTER TABLE sdk_sessions ADD COLUMN worker_port INTEGER"),_.debug("DB","Added worker_port column to sdk_sessions table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(5,new Date().toISOString())}ensurePromptTrackingColumns(){this.db.query("PRAGMA table_info(sdk_sessions)").all().some(a=>a.name==="prompt_counter")||(this.db.run("ALTER TABLE sdk_sessions ADD COLUMN prompt_counter INTEGER DEFAULT 0"),_.debug("DB","Added prompt_counter column to sdk_sessions table")),this.db.query("PRAGMA table_info(observations)").all().some(a=>a.name==="prompt_number")||(this.db.run("ALTER TABLE observations ADD COLUMN prompt_number INTEGER"),_.debug("DB","Added prompt_number column to observations table")),this.db.query("PRAGMA table_info(session_summaries)").all().some(a=>a.name==="prompt_number")||(this.db.run("ALTER TABLE session_summaries ADD COLUMN prompt_number INTEGER"),_.debug("DB","Added prompt_number column to session_summaries table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(6,new Date().toISOString())}removeSessionSummariesUniqueConstraint(){if(!this.db.query("PRAGMA index_list(session_summaries)").all().some(t=>t.unique===1)){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(7,new Date().toISOString());return}_.debug("DB","Removing UNIQUE constraint from session_summaries.memory_session_id"),this.db.run("BEGIN TRANSACTION"),this.db.run("DROP TABLE IF EXISTS session_summaries_new"),this.db.run(`
      CREATE TABLE session_summaries_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        request TEXT,
        investigated TEXT,
        learned TEXT,
        completed TEXT,
        next_steps TEXT,
        files_read TEXT,
        files_edited TEXT,
        notes TEXT,
        prompt_number INTEGER,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE
      )
    `),this.db.run(`
      INSERT INTO session_summaries_new
      SELECT id, memory_session_id, project, request, investigated, learned,
             completed, next_steps, files_read, files_edited, notes,
             prompt_number, created_at, created_at_epoch
      FROM session_summaries
    `),this.db.run("DROP TABLE session_summaries"),this.db.run("ALTER TABLE session_summaries_new RENAME TO session_summaries"),this.db.run(`
      CREATE INDEX idx_session_summaries_sdk_session ON session_summaries(memory_session_id);
      CREATE INDEX idx_session_summaries_project ON session_summaries(project);
      CREATE INDEX idx_session_summaries_created ON session_summaries(created_at_epoch DESC);
    `),this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(7,new Date().toISOString()),_.debug("DB","Successfully removed UNIQUE constraint from session_summaries.memory_session_id")}addObservationHierarchicalFields(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(8))return;if(this.db.query("PRAGMA table_info(observations)").all().some(r=>r.name==="title")){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(8,new Date().toISOString());return}_.debug("DB","Adding hierarchical fields to observations table"),this.db.run(`
      ALTER TABLE observations ADD COLUMN title TEXT;
      ALTER TABLE observations ADD COLUMN subtitle TEXT;
      ALTER TABLE observations ADD COLUMN facts TEXT;
      ALTER TABLE observations ADD COLUMN narrative TEXT;
      ALTER TABLE observations ADD COLUMN concepts TEXT;
      ALTER TABLE observations ADD COLUMN files_read TEXT;
      ALTER TABLE observations ADD COLUMN files_modified TEXT;
    `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(8,new Date().toISOString()),_.debug("DB","Successfully added hierarchical fields to observations table")}makeObservationsTextNullable(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(9))return;let t=this.db.query("PRAGMA table_info(observations)").all().find(r=>r.name==="text");if(!t||t.notnull===0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(9,new Date().toISOString());return}_.debug("DB","Making observations.text nullable"),this.db.run("BEGIN TRANSACTION"),this.db.run("DROP TABLE IF EXISTS observations_new"),this.db.run(`
      CREATE TABLE observations_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        text TEXT,
        type TEXT NOT NULL,
        title TEXT,
        subtitle TEXT,
        facts TEXT,
        narrative TEXT,
        concepts TEXT,
        files_read TEXT,
        files_modified TEXT,
        prompt_number INTEGER,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE
      )
    `),this.db.run(`
      INSERT INTO observations_new
      SELECT id, memory_session_id, project, text, type, title, subtitle, facts,
             narrative, concepts, files_read, files_modified, prompt_number,
             created_at, created_at_epoch
      FROM observations
    `),this.db.run("DROP TABLE observations"),this.db.run("ALTER TABLE observations_new RENAME TO observations"),this.db.run(`
      CREATE INDEX idx_observations_sdk_session ON observations(memory_session_id);
      CREATE INDEX idx_observations_project ON observations(project);
      CREATE INDEX idx_observations_type ON observations(type);
      CREATE INDEX idx_observations_created ON observations(created_at_epoch DESC);
    `),this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(9,new Date().toISOString()),_.debug("DB","Successfully made observations.text nullable")}createUserPromptsTable(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(10))return;if(this.db.query("PRAGMA table_info(user_prompts)").all().length>0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(10,new Date().toISOString());return}_.debug("DB","Creating user_prompts table with FTS5 support"),this.db.run("BEGIN TRANSACTION"),this.db.run(`
      CREATE TABLE user_prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_session_id TEXT NOT NULL,
        prompt_number INTEGER NOT NULL,
        prompt_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(content_session_id) REFERENCES sdk_sessions(content_session_id) ON DELETE CASCADE
      );

      CREATE INDEX idx_user_prompts_claude_session ON user_prompts(content_session_id);
      CREATE INDEX idx_user_prompts_created ON user_prompts(created_at_epoch DESC);
      CREATE INDEX idx_user_prompts_prompt_number ON user_prompts(prompt_number);
      CREATE INDEX idx_user_prompts_lookup ON user_prompts(content_session_id, prompt_number);
    `);try{this.db.run(`
        CREATE VIRTUAL TABLE user_prompts_fts USING fts5(
          prompt_text,
          content='user_prompts',
          content_rowid='id'
        );
      `),this.db.run(`
        CREATE TRIGGER user_prompts_ai AFTER INSERT ON user_prompts BEGIN
          INSERT INTO user_prompts_fts(rowid, prompt_text)
          VALUES (new.id, new.prompt_text);
        END;

        CREATE TRIGGER user_prompts_ad AFTER DELETE ON user_prompts BEGIN
          INSERT INTO user_prompts_fts(user_prompts_fts, rowid, prompt_text)
          VALUES('delete', old.id, old.prompt_text);
        END;

        CREATE TRIGGER user_prompts_au AFTER UPDATE ON user_prompts BEGIN
          INSERT INTO user_prompts_fts(user_prompts_fts, rowid, prompt_text)
          VALUES('delete', old.id, old.prompt_text);
          INSERT INTO user_prompts_fts(rowid, prompt_text)
          VALUES (new.id, new.prompt_text);
        END;
      `)}catch(t){_.warn("DB","FTS5 not available \u2014 user_prompts_fts skipped (search uses ChromaDB)",{},t)}this.db.run("COMMIT"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(10,new Date().toISOString()),_.debug("DB","Successfully created user_prompts table")}ensureDiscoveryTokensColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(11))return;this.db.query("PRAGMA table_info(observations)").all().some(i=>i.name==="discovery_tokens")||(this.db.run("ALTER TABLE observations ADD COLUMN discovery_tokens INTEGER DEFAULT 0"),_.debug("DB","Added discovery_tokens column to observations table")),this.db.query("PRAGMA table_info(session_summaries)").all().some(i=>i.name==="discovery_tokens")||(this.db.run("ALTER TABLE session_summaries ADD COLUMN discovery_tokens INTEGER DEFAULT 0"),_.debug("DB","Added discovery_tokens column to session_summaries table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(11,new Date().toISOString())}createPendingMessagesTable(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(16))return;if(this.db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='pending_messages'").all().length>0){this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(16,new Date().toISOString());return}_.debug("DB","Creating pending_messages table"),this.db.run(`
      CREATE TABLE pending_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_db_id INTEGER NOT NULL,
        content_session_id TEXT NOT NULL,
        message_type TEXT NOT NULL CHECK(message_type IN ('observation', 'summarize')),
        tool_name TEXT,
        tool_input TEXT,
        tool_response TEXT,
        cwd TEXT,
        last_user_message TEXT,
        last_assistant_message TEXT,
        prompt_number INTEGER,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'processed', 'failed')),
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at_epoch INTEGER NOT NULL,
        started_processing_at_epoch INTEGER,
        completed_at_epoch INTEGER,
        FOREIGN KEY (session_db_id) REFERENCES sdk_sessions(id) ON DELETE CASCADE
      )
    `),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_session ON pending_messages(session_db_id)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_status ON pending_messages(status)"),this.db.run("CREATE INDEX IF NOT EXISTS idx_pending_messages_claude_session ON pending_messages(content_session_id)"),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(16,new Date().toISOString()),_.debug("DB","pending_messages table created successfully")}renameSessionIdColumns(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(17))return;_.debug("DB","Checking session ID columns for semantic clarity rename");let s=0,t=(r,o,i)=>{let a=this.db.query(`PRAGMA table_info(${r})`).all(),d=a.some(m=>m.name===o);return a.some(m=>m.name===i)?!1:d?(this.db.run(`ALTER TABLE ${r} RENAME COLUMN ${o} TO ${i}`),_.debug("DB",`Renamed ${r}.${o} to ${i}`),!0):(_.warn("DB",`Column ${o} not found in ${r}, skipping rename`),!1)};t("sdk_sessions","claude_session_id","content_session_id")&&s++,t("sdk_sessions","sdk_session_id","memory_session_id")&&s++,t("pending_messages","claude_session_id","content_session_id")&&s++,t("observations","sdk_session_id","memory_session_id")&&s++,t("session_summaries","sdk_session_id","memory_session_id")&&s++,t("user_prompts","claude_session_id","content_session_id")&&s++,this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(17,new Date().toISOString()),s>0?_.debug("DB",`Successfully renamed ${s} session ID columns`):_.debug("DB","No session ID column renames needed (already up to date)")}repairSessionIdColumnRename(){this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(19)||this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(19,new Date().toISOString())}addFailedAtEpochColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(20))return;this.db.query("PRAGMA table_info(pending_messages)").all().some(r=>r.name==="failed_at_epoch")||(this.db.run("ALTER TABLE pending_messages ADD COLUMN failed_at_epoch INTEGER"),_.debug("DB","Added failed_at_epoch column to pending_messages table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(20,new Date().toISOString())}addOnUpdateCascadeToForeignKeys(){if(!this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(21)){_.debug("DB","Adding ON UPDATE CASCADE to FK constraints on observations and session_summaries"),this.db.run("PRAGMA foreign_keys = OFF"),this.db.run("BEGIN TRANSACTION");try{this.db.run("DROP TRIGGER IF EXISTS observations_ai"),this.db.run("DROP TRIGGER IF EXISTS observations_ad"),this.db.run("DROP TRIGGER IF EXISTS observations_au"),this.db.run("DROP TABLE IF EXISTS observations_new"),this.db.run(`
        CREATE TABLE observations_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memory_session_id TEXT NOT NULL,
          project TEXT NOT NULL,
          text TEXT,
          type TEXT NOT NULL,
          title TEXT,
          subtitle TEXT,
          facts TEXT,
          narrative TEXT,
          concepts TEXT,
          files_read TEXT,
          files_modified TEXT,
          prompt_number INTEGER,
          discovery_tokens INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          created_at_epoch INTEGER NOT NULL,
          FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE
        )
      `),this.db.run(`
        INSERT INTO observations_new
        SELECT id, memory_session_id, project, text, type, title, subtitle, facts,
               narrative, concepts, files_read, files_modified, prompt_number,
               discovery_tokens, created_at, created_at_epoch
        FROM observations
      `),this.db.run("DROP TABLE observations"),this.db.run("ALTER TABLE observations_new RENAME TO observations"),this.db.run(`
        CREATE INDEX idx_observations_sdk_session ON observations(memory_session_id);
        CREATE INDEX idx_observations_project ON observations(project);
        CREATE INDEX idx_observations_type ON observations(type);
        CREATE INDEX idx_observations_created ON observations(created_at_epoch DESC);
      `),this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='observations_fts'").all().length>0&&this.db.run(`
          CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
            INSERT INTO observations_fts(rowid, title, subtitle, narrative, text, facts, concepts)
            VALUES (new.id, new.title, new.subtitle, new.narrative, new.text, new.facts, new.concepts);
          END;

          CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
            INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, text, facts, concepts)
            VALUES('delete', old.id, old.title, old.subtitle, old.narrative, old.text, old.facts, old.concepts);
          END;

          CREATE TRIGGER IF NOT EXISTS observations_au AFTER UPDATE ON observations BEGIN
            INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, text, facts, concepts)
            VALUES('delete', old.id, old.title, old.subtitle, old.narrative, old.text, old.facts, old.concepts);
            INSERT INTO observations_fts(rowid, title, subtitle, narrative, text, facts, concepts)
            VALUES (new.id, new.title, new.subtitle, new.narrative, new.text, new.facts, new.concepts);
          END;
        `),this.db.run("DROP TABLE IF EXISTS session_summaries_new"),this.db.run(`
        CREATE TABLE session_summaries_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memory_session_id TEXT NOT NULL,
          project TEXT NOT NULL,
          request TEXT,
          investigated TEXT,
          learned TEXT,
          completed TEXT,
          next_steps TEXT,
          files_read TEXT,
          files_edited TEXT,
          notes TEXT,
          prompt_number INTEGER,
          discovery_tokens INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          created_at_epoch INTEGER NOT NULL,
          FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE ON UPDATE CASCADE
        )
      `),this.db.run(`
        INSERT INTO session_summaries_new
        SELECT id, memory_session_id, project, request, investigated, learned,
               completed, next_steps, files_read, files_edited, notes,
               prompt_number, discovery_tokens, created_at, created_at_epoch
        FROM session_summaries
      `),this.db.run("DROP TRIGGER IF EXISTS session_summaries_ai"),this.db.run("DROP TRIGGER IF EXISTS session_summaries_ad"),this.db.run("DROP TRIGGER IF EXISTS session_summaries_au"),this.db.run("DROP TABLE session_summaries"),this.db.run("ALTER TABLE session_summaries_new RENAME TO session_summaries"),this.db.run(`
        CREATE INDEX idx_session_summaries_sdk_session ON session_summaries(memory_session_id);
        CREATE INDEX idx_session_summaries_project ON session_summaries(project);
        CREATE INDEX idx_session_summaries_created ON session_summaries(created_at_epoch DESC);
      `),this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_summaries_fts'").all().length>0&&this.db.run(`
          CREATE TRIGGER IF NOT EXISTS session_summaries_ai AFTER INSERT ON session_summaries BEGIN
            INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps, notes)
            VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps, new.notes);
          END;

          CREATE TRIGGER IF NOT EXISTS session_summaries_ad AFTER DELETE ON session_summaries BEGIN
            INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps, notes)
            VALUES('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps, old.notes);
          END;

          CREATE TRIGGER IF NOT EXISTS session_summaries_au AFTER UPDATE ON session_summaries BEGIN
            INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps, notes)
            VALUES('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps, old.notes);
            INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps, notes)
            VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps, new.notes);
          END;
        `),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(21,new Date().toISOString()),this.db.run("COMMIT"),this.db.run("PRAGMA foreign_keys = ON"),_.debug("DB","Successfully added ON UPDATE CASCADE to FK constraints")}catch(s){throw this.db.run("ROLLBACK"),this.db.run("PRAGMA foreign_keys = ON"),s}}}addObservationContentHashColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(22))return;this.db.query("PRAGMA table_info(observations)").all().some(r=>r.name==="content_hash")||(this.db.run("ALTER TABLE observations ADD COLUMN content_hash TEXT"),this.db.run("UPDATE observations SET content_hash = substr(hex(randomblob(8)), 1, 16) WHERE content_hash IS NULL"),this.db.run("CREATE INDEX IF NOT EXISTS idx_observations_content_hash ON observations(content_hash, created_at_epoch)"),_.debug("DB","Added content_hash column to observations table with backfill and index")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(22,new Date().toISOString())}addSessionCustomTitleColumn(){if(this.db.prepare("SELECT version FROM schema_versions WHERE version = ?").get(23))return;this.db.query("PRAGMA table_info(sdk_sessions)").all().some(r=>r.name==="custom_title")||(this.db.run("ALTER TABLE sdk_sessions ADD COLUMN custom_title TEXT"),_.debug("DB","Added custom_title column to sdk_sessions table")),this.db.prepare("INSERT OR IGNORE INTO schema_versions (version, applied_at) VALUES (?, ?)").run(23,new Date().toISOString())}updateMemorySessionId(e,s){this.db.prepare(`
      UPDATE sdk_sessions
      SET memory_session_id = ?
      WHERE id = ?
    `).run(s,e)}ensureMemorySessionIdRegistered(e,s){let t=this.db.prepare(`
      SELECT id, memory_session_id FROM sdk_sessions WHERE id = ?
    `).get(e);if(!t)throw new Error(`Session ${e} not found in sdk_sessions`);t.memory_session_id!==s&&(this.db.prepare(`
        UPDATE sdk_sessions SET memory_session_id = ? WHERE id = ?
      `).run(s,e),_.info("DB","Registered memory_session_id before storage (FK fix)",{sessionDbId:e,oldId:t.memory_session_id,newId:s}))}getRecentSummaries(e,s=10){return this.db.prepare(`
      SELECT
        request, investigated, learned, completed, next_steps,
        files_read, files_edited, notes, prompt_number, created_at
      FROM session_summaries
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,s)}getRecentSummariesWithSessionInfo(e,s=3){return this.db.prepare(`
      SELECT
        memory_session_id, request, learned, completed, next_steps,
        prompt_number, created_at
      FROM session_summaries
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,s)}getRecentObservations(e,s=20){return this.db.prepare(`
      SELECT type, text, prompt_number, created_at
      FROM observations
      WHERE project = ?
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e,s)}getAllRecentObservations(e=100){return this.db.prepare(`
      SELECT id, type, title, subtitle, text, project, prompt_number, created_at, created_at_epoch
      FROM observations
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e)}getAllRecentSummaries(e=50){return this.db.prepare(`
      SELECT id, request, investigated, learned, completed, next_steps,
             files_read, files_edited, notes, project, prompt_number,
             created_at, created_at_epoch
      FROM session_summaries
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `).all(e)}getAllRecentUserPrompts(e=100){return this.db.prepare(`
      SELECT
        up.id,
        up.content_session_id,
        s.project,
        up.prompt_number,
        up.prompt_text,
        up.created_at,
        up.created_at_epoch
      FROM user_prompts up
      LEFT JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
      ORDER BY up.created_at_epoch DESC
      LIMIT ?
    `).all(e)}getAllProjects(){return this.db.prepare(`
      SELECT DISTINCT project
      FROM sdk_sessions
      WHERE project IS NOT NULL AND project != ''
      ORDER BY project ASC
    `).all().map(t=>t.project)}getLatestUserPrompt(e){return this.db.prepare(`
      SELECT
        up.*,
        s.memory_session_id,
        s.project
      FROM user_prompts up
      JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
      WHERE up.content_session_id = ?
      ORDER BY up.created_at_epoch DESC
      LIMIT 1
    `).get(e)}getRecentSessionsWithStatus(e,s=3,t={}){let r="s.project = ?",o=[];return t.repoId?(r=`
        (
          s.repo_id = ?
          OR (s.repo_id IS NULL AND s.repo_root = ?)
          OR (s.repo_id IS NULL AND s.repo_root IS NULL AND s.project = ?)
        )
      `,o.push(t.repoId,t.repoRoot||"",e)):t.repoRoot?(r="(s.repo_root = ? OR (s.repo_root IS NULL AND s.project = ?))",o.push(t.repoRoot,e)):o.push(e),this.db.prepare(`
      SELECT * FROM (
        SELECT
          s.memory_session_id,
          s.status,
          s.started_at,
          s.started_at_epoch,
          s.user_prompt,
          CASE WHEN sum.memory_session_id IS NOT NULL THEN 1 ELSE 0 END as has_summary
        FROM sdk_sessions s
        LEFT JOIN session_summaries sum ON s.memory_session_id = sum.memory_session_id
        WHERE ${r} AND s.memory_session_id IS NOT NULL
        GROUP BY s.memory_session_id
        ORDER BY s.started_at_epoch DESC
        LIMIT ?
      )
      ORDER BY started_at_epoch ASC
    `).all(...o,s)}getObservationsForSession(e){return this.db.prepare(`
      SELECT title, subtitle, type, prompt_number
      FROM observations
      WHERE memory_session_id = ?
      ORDER BY created_at_epoch ASC
    `).all(e)}getObservationById(e){return this.db.prepare(`
      SELECT *
      FROM observations
      WHERE id = ?
    `).get(e)||null}getObservationsByIds(e,s={}){if(e.length===0)return[];let{orderBy:t="date_desc",limit:r,project:o,repoRoot:i,repoId:a,type:d,concepts:p,files:m}=s,l=t==="date_asc"?"ASC":"DESC",u=r?`LIMIT ${r}`:"",T=e.map(()=>"?").join(","),h=[...e],g=[];if(a?(g.push(`(
        repo_id = ?
        OR (repo_id IS NULL AND repo_root = ?)
        OR (repo_id IS NULL AND repo_root IS NULL AND project = ?)
      )`),h.push(a,i||"",o||"")):i?(g.push("(repo_root = ? OR (repo_root IS NULL AND project = ?))"),h.push(i,o||"")):o&&(g.push("project = ?"),h.push(o)),d)if(Array.isArray(d)){let N=d.map(()=>"?").join(",");g.push(`type IN (${N})`),h.push(...d)}else g.push("type = ?"),h.push(d);if(p){let N=Array.isArray(p)?p:[p],R=N.map(()=>"EXISTS (SELECT 1 FROM json_each(concepts) WHERE value = ?)");h.push(...N),g.push(`(${R.join(" OR ")})`)}if(m){let N=Array.isArray(m)?m:[m],R=N.map(()=>"(EXISTS (SELECT 1 FROM json_each(files_read) WHERE value LIKE ?) OR EXISTS (SELECT 1 FROM json_each(files_modified) WHERE value LIKE ?))");N.forEach(ne=>{h.push(`%${ne}%`,`%${ne}%`)}),g.push(`(${R.join(" OR ")})`)}let c=g.length>0?`WHERE id IN (${T}) AND ${g.join(" AND ")}`:`WHERE id IN (${T})`;return this.db.prepare(`
      SELECT *
      FROM observations
      ${c}
      ORDER BY created_at_epoch ${l}
      ${u}
    `).all(...h)}getSummaryForSession(e){return this.db.prepare(`
      SELECT
        request, investigated, learned, completed, next_steps,
        files_read, files_edited, notes, prompt_number, created_at,
        created_at_epoch
      FROM session_summaries
      WHERE memory_session_id = ?
      ORDER BY created_at_epoch DESC
      LIMIT 1
    `).get(e)||null}getFilesForSession(e){let t=this.db.prepare(`
      SELECT files_read, files_modified
      FROM observations
      WHERE memory_session_id = ?
    `).all(e),r=new Set,o=new Set;for(let i of t){if(i.files_read){let a=JSON.parse(i.files_read);Array.isArray(a)&&a.forEach(d=>r.add(d))}if(i.files_modified){let a=JSON.parse(i.files_modified);Array.isArray(a)&&a.forEach(d=>o.add(d))}}return{filesRead:Array.from(r),filesModified:Array.from(o)}}getSessionById(e){return this.db.prepare(`
      SELECT id, content_session_id, memory_session_id, project, user_prompt, custom_title,
             platform, client_kind, capture_mode, platform_session_id, parent_session_id,
             agent_role, repo_root, repo_id, git_branch, git_commit
      FROM sdk_sessions
      WHERE id = ?
      LIMIT 1
    `).get(e)||null}getSdkSessionsBySessionIds(e){if(e.length===0)return[];let s=e.map(()=>"?").join(",");return this.db.prepare(`
      SELECT id, content_session_id, memory_session_id, project, user_prompt, custom_title,
             platform, client_kind, capture_mode, platform_session_id, parent_session_id,
             agent_role, repo_root, repo_id, git_branch, git_commit,
             started_at, started_at_epoch, completed_at, completed_at_epoch, status
      FROM sdk_sessions
      WHERE memory_session_id IN (${s})
      ORDER BY started_at_epoch DESC
    `).all(...e)}getPromptNumberFromUserPrompts(e){return this.db.prepare(`
      SELECT COUNT(*) as count FROM user_prompts WHERE content_session_id = ?
    `).get(e).count}normalizeMetadataValue(e){if(e==null)return null;let s=e.trim();return s||null}updateSessionMetadata(e,s){s&&this.db.prepare(`
      UPDATE sdk_sessions
      SET
        platform = COALESCE(?, platform),
        client_kind = COALESCE(?, client_kind),
        capture_mode = COALESCE(?, capture_mode),
        platform_session_id = COALESCE(?, platform_session_id),
        parent_session_id = COALESCE(?, parent_session_id),
        agent_role = COALESCE(?, agent_role),
        repo_root = COALESCE(?, repo_root),
        repo_id = COALESCE(?, repo_id),
        git_branch = COALESCE(?, git_branch),
        git_commit = COALESCE(?, git_commit)
      WHERE content_session_id = ?
    `).run(s.platform||null,s.clientKind||null,s.captureMode||null,this.normalizeMetadataValue(s.platformSessionId)||e,this.normalizeMetadataValue(s.parentSessionId),this.normalizeMetadataValue(s.agentRole),this.normalizeMetadataValue(s.repoRoot),this.normalizeMetadataValue(s.repoId),this.normalizeMetadataValue(s.gitBranch),this.normalizeMetadataValue(s.gitCommit),e)}markSessionCompleted(e,s=Date.now()){let t=new Date(s).toISOString();return this.db.prepare(`
      UPDATE sdk_sessions
      SET
        completed_at = CASE
          WHEN completed_at_epoch IS NULL OR completed_at_epoch < ? THEN ?
          ELSE completed_at
        END,
        completed_at_epoch = CASE
          WHEN completed_at_epoch IS NULL OR completed_at_epoch < ? THEN ?
          ELSE completed_at_epoch
        END,
        status = 'completed'
      WHERE id = ?
    `).run(s,t,s,s,e).changes>0}createSDKSession(e,s,t,r,o,i){let a=i??Date.now(),d=new Date(a).toISOString(),p=this.db.prepare(`
      SELECT id FROM sdk_sessions WHERE content_session_id = ?
    `).get(e);return p?(s&&this.db.prepare(`
          UPDATE sdk_sessions SET project = ?
          WHERE content_session_id = ? AND (project IS NULL OR project = '')
        `).run(s,e),r&&this.db.prepare(`
          UPDATE sdk_sessions SET custom_title = ?
          WHERE content_session_id = ? AND custom_title IS NULL
        `).run(r,e),i!==void 0&&this.db.prepare(`
          UPDATE sdk_sessions
          SET
            started_at = CASE
              WHEN started_at_epoch IS NULL OR started_at_epoch > ? THEN ?
              ELSE started_at
            END,
            started_at_epoch = CASE
              WHEN started_at_epoch IS NULL OR started_at_epoch > ? THEN ?
              ELSE started_at_epoch
            END
          WHERE content_session_id = ?
        `).run(i,d,i,i,e),this.updateSessionMetadata(e,o),p.id):(this.db.prepare(`
      INSERT INTO sdk_sessions
      (
        content_session_id, memory_session_id, project, user_prompt, custom_title,
        platform, client_kind, capture_mode, platform_session_id, parent_session_id, agent_role,
        repo_root, repo_id, git_branch, git_commit,
        started_at, started_at_epoch, status
      )
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(e,s,t,r||null,o?.platform||"claude",o?.clientKind||"claude-code",o?.captureMode||"hook",this.normalizeMetadataValue(o?.platformSessionId)||e,this.normalizeMetadataValue(o?.parentSessionId),this.normalizeMetadataValue(o?.agentRole),this.normalizeMetadataValue(o?.repoRoot),this.normalizeMetadataValue(o?.repoId),this.normalizeMetadataValue(o?.gitBranch),this.normalizeMetadataValue(o?.gitCommit),d,a),this.db.prepare("SELECT id FROM sdk_sessions WHERE content_session_id = ?").get(e).id)}saveUserPrompt(e,s,t,r,o){let i=o??Date.now(),a=new Date(i).toISOString();return this.db.prepare(`
      INSERT INTO user_prompts
      (
        content_session_id, prompt_number, prompt_text,
        platform, client_kind, capture_mode, platform_turn_id, raw_event_id,
        repo_root, repo_id, git_branch, git_commit, parent_session_id, agent_role,
        created_at, created_at_epoch
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e,s,t,r?.platform||"claude",r?.clientKind||"claude-code",r?.captureMode||"hook",this.normalizeMetadataValue(r?.platformTurnId),r?.rawEventId||null,this.normalizeMetadataValue(r?.repoRoot),this.normalizeMetadataValue(r?.repoId),this.normalizeMetadataValue(r?.gitBranch),this.normalizeMetadataValue(r?.gitCommit),this.normalizeMetadataValue(r?.parentSessionId),this.normalizeMetadataValue(r?.agentRole),a,i).lastInsertRowid}storeRawEvent(e,s){let t=this.db.prepare(`
      SELECT id FROM raw_events WHERE payload_hash = ? LIMIT 1
    `).get(e.payloadHash);if(t)return{id:t.id,inserted:!1};let r=new Date(e.createdAtEpochMs).toISOString(),i=this.db.prepare(`
      INSERT INTO raw_events (
        event_uuid, platform, client_kind, capture_mode,
        platform_session_id, platform_turn_id, item_id, parent_session_id, agent_role,
        event_type, cwd, project, repo_root, repo_id, git_branch, git_commit,
        payload_json, payload_hash, privacy_state, source_confidence,
        created_at, created_at_epoch, session_db_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e.id,e.platform,e.clientKind,e.captureMode,e.platformSessionId,this.normalizeMetadataValue(e.platformTurnId),this.normalizeMetadataValue(e.itemId),this.normalizeMetadataValue(e.parentSessionId),this.normalizeMetadataValue(e.agentRole),e.eventType,this.normalizeMetadataValue(e.cwd),this.normalizeMetadataValue(e.project),this.normalizeMetadataValue(e.repoRoot),this.normalizeMetadataValue(e.repoId),this.normalizeMetadataValue(e.gitBranch),this.normalizeMetadataValue(e.gitCommit),e.payloadJson,e.payloadHash,e.privacyState,e.sourceConfidence,r,e.createdAtEpochMs,s||null);return{id:Number(i.lastInsertRowid),inserted:!0}}storeRawEvents(e,s){return e.map(t=>this.storeRawEvent(t,s))}listRawEvents(e={}){let s=[],t=[];e.platformSessionId&&(s.push("platform_session_id = ?"),t.push(e.platformSessionId)),e.platform&&(s.push("platform = ?"),t.push(e.platform)),e.eventType&&(s.push("event_type = ?"),t.push(e.eventType)),e.repoId&&(s.push("repo_id = ?"),t.push(e.repoId));let r=s.length?`WHERE ${s.join(" AND ")}`:"",o=e.limit??100,i=e.offset??0;return this.db.prepare(`
      SELECT * FROM raw_events
      ${r}
      ORDER BY created_at_epoch DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(...t,o,i)}getRawEventReplay(e,s=200){return this.listRawEvents({platformSessionId:e,limit:s})}getUserPrompt(e,s){return this.db.prepare(`
      SELECT prompt_text
      FROM user_prompts
      WHERE content_session_id = ? AND prompt_number = ?
      LIMIT 1
    `).get(e,s)?.prompt_text??null}storeObservation(e,s,t,r,o=0,i,a){let d=i??Date.now(),p=new Date(d).toISOString(),m=Ne(e,t.title,t.narrative),l=he(this.db,m,d);if(l)return{id:l.id,createdAtEpoch:l.created_at_epoch};let T=this.db.prepare(`
      INSERT INTO observations
      (
        memory_session_id, project, type, title, subtitle, facts, narrative, concepts,
        files_read, files_modified, prompt_number, discovery_tokens, content_hash,
        uuid, platform, client_kind, capture_mode, capture_fidelity, raw_event_id,
        platform_session_id, platform_turn_id, repo_root, repo_id, git_branch, git_commit,
        parent_session_id, agent_role, superseded_by, staleness_score,
        created_at, created_at_epoch
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e,s,t.type,t.title,t.subtitle,JSON.stringify(t.facts),t.narrative,JSON.stringify(t.concepts),JSON.stringify(t.files_read),JSON.stringify(t.files_modified),r||null,o,m,(0,y.randomUUID)(),a?.platform||"claude",a?.clientKind||"claude-code",a?.captureMode||"hook",a?.captureFidelity||"high",a?.rawEventId||null,this.normalizeMetadataValue(a?.platformSessionId),this.normalizeMetadataValue(a?.platformTurnId),this.normalizeMetadataValue(a?.repoRoot),this.normalizeMetadataValue(a?.repoId),this.normalizeMetadataValue(a?.gitBranch),this.normalizeMetadataValue(a?.gitCommit),this.normalizeMetadataValue(a?.parentSessionId),this.normalizeMetadataValue(a?.agentRole),a?.supersededBy||null,a?.stalenessScore??0,p,d);return{id:Number(T.lastInsertRowid),createdAtEpoch:d}}storeSummary(e,s,t,r,o=0,i,a){let d=i??Date.now(),p=new Date(d).toISOString(),l=this.db.prepare(`
      INSERT INTO session_summaries
      (
        memory_session_id, project, request, investigated, learned, completed,
        next_steps, notes, prompt_number, discovery_tokens,
        uuid, platform, client_kind, capture_mode, capture_fidelity, raw_event_id,
        platform_session_id, platform_turn_id, repo_root, repo_id, git_branch, git_commit,
        parent_session_id, agent_role, superseded_by, staleness_score,
        created_at, created_at_epoch
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e,s,t.request,t.investigated,t.learned,t.completed,t.next_steps,t.notes,r||null,o,(0,y.randomUUID)(),a?.platform||"claude",a?.clientKind||"claude-code",a?.captureMode||"hook",a?.captureFidelity||"high",a?.rawEventId||null,this.normalizeMetadataValue(a?.platformSessionId),this.normalizeMetadataValue(a?.platformTurnId),this.normalizeMetadataValue(a?.repoRoot),this.normalizeMetadataValue(a?.repoId),this.normalizeMetadataValue(a?.gitBranch),this.normalizeMetadataValue(a?.gitCommit),this.normalizeMetadataValue(a?.parentSessionId),this.normalizeMetadataValue(a?.agentRole),a?.supersededBy||null,a?.stalenessScore??0,p,d);return{id:Number(l.lastInsertRowid),createdAtEpoch:d}}storeObservations(e,s,t,r,o,i=0,a,d){let p=a??Date.now(),m=new Date(p).toISOString();return this.db.transaction(()=>{let u=[],T=this.db.prepare(`
        INSERT INTO observations
        (
          memory_session_id, project, type, title, subtitle, facts, narrative, concepts,
          files_read, files_modified, prompt_number, discovery_tokens,
          uuid, platform, client_kind, capture_mode, capture_fidelity, raw_event_id,
          platform_session_id, platform_turn_id, repo_root, repo_id, git_branch, git_commit,
          parent_session_id, agent_role, superseded_by, staleness_score,
          created_at, created_at_epoch
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);for(let g of t){let c=T.run(e,s,g.type,g.title,g.subtitle,JSON.stringify(g.facts),g.narrative,JSON.stringify(g.concepts),JSON.stringify(g.files_read),JSON.stringify(g.files_modified),o||null,i,(0,y.randomUUID)(),d?.platform||"claude",d?.clientKind||"claude-code",d?.captureMode||"hook",d?.captureFidelity||"high",d?.rawEventId||null,this.normalizeMetadataValue(d?.platformSessionId),this.normalizeMetadataValue(d?.platformTurnId),this.normalizeMetadataValue(d?.repoRoot),this.normalizeMetadataValue(d?.repoId),this.normalizeMetadataValue(d?.gitBranch),this.normalizeMetadataValue(d?.gitCommit),this.normalizeMetadataValue(d?.parentSessionId),this.normalizeMetadataValue(d?.agentRole),d?.supersededBy||null,d?.stalenessScore??0,m,p);u.push(Number(c.lastInsertRowid))}let h=null;if(r){let c=this.db.prepare(`
          INSERT INTO session_summaries
          (
            memory_session_id, project, request, investigated, learned, completed,
            next_steps, notes, prompt_number, discovery_tokens,
            uuid, platform, client_kind, capture_mode, capture_fidelity, raw_event_id,
            platform_session_id, platform_turn_id, repo_root, repo_id, git_branch, git_commit,
            parent_session_id, agent_role, superseded_by, staleness_score,
            created_at, created_at_epoch
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(e,s,r.request,r.investigated,r.learned,r.completed,r.next_steps,r.notes,o||null,i,(0,y.randomUUID)(),d?.platform||"claude",d?.clientKind||"claude-code",d?.captureMode||"hook",d?.captureFidelity||"high",d?.rawEventId||null,this.normalizeMetadataValue(d?.platformSessionId),this.normalizeMetadataValue(d?.platformTurnId),this.normalizeMetadataValue(d?.repoRoot),this.normalizeMetadataValue(d?.repoId),this.normalizeMetadataValue(d?.gitBranch),this.normalizeMetadataValue(d?.gitCommit),this.normalizeMetadataValue(d?.parentSessionId),this.normalizeMetadataValue(d?.agentRole),d?.supersededBy||null,d?.stalenessScore??0,m,p);h=Number(c.lastInsertRowid)}return{observationIds:u,summaryId:h,createdAtEpoch:p}})()}storeObservationsAndMarkComplete(e,s,t,r,o,i,a,d=0,p){let m=p??Date.now(),l=new Date(m).toISOString();return this.db.transaction(()=>{let T=[],h=this.db.prepare(`
        INSERT INTO observations
        (memory_session_id, project, type, title, subtitle, facts, narrative, concepts,
         files_read, files_modified, prompt_number, discovery_tokens, created_at, created_at_epoch)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);for(let b of t){let N=h.run(e,s,b.type,b.title,b.subtitle,JSON.stringify(b.facts),b.narrative,JSON.stringify(b.concepts),JSON.stringify(b.files_read),JSON.stringify(b.files_modified),a||null,d,l,m);T.push(Number(N.lastInsertRowid))}let g;if(r){let N=this.db.prepare(`
          INSERT INTO session_summaries
          (memory_session_id, project, request, investigated, learned, completed,
           next_steps, notes, prompt_number, discovery_tokens, created_at, created_at_epoch)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(e,s,r.request,r.investigated,r.learned,r.completed,r.next_steps,r.notes,a||null,d,l,m);g=Number(N.lastInsertRowid)}return this.db.prepare(`
        UPDATE pending_messages
        SET
          status = 'processed',
          completed_at_epoch = ?,
          tool_input = NULL,
          tool_response = NULL
        WHERE id = ? AND status = 'processing'
      `).run(m,o),{observationIds:T,summaryId:g,createdAtEpoch:m}})()}getSessionSummariesByIds(e,s={}){if(e.length===0)return[];let{orderBy:t="date_desc",limit:r,project:o,repoRoot:i,repoId:a}=s,d=t==="date_asc"?"ASC":"DESC",p=r?`LIMIT ${r}`:"",m=e.map(()=>"?").join(","),l=[...e],u=[];a?(u.push(`(
        repo_id = ?
        OR (repo_id IS NULL AND repo_root = ?)
        OR (repo_id IS NULL AND repo_root IS NULL AND project = ?)
      )`),l.push(a,i||"",o||"")):i?(u.push("(repo_root = ? OR (repo_root IS NULL AND project = ?))"),l.push(i,o||"")):o&&(u.push("project = ?"),l.push(o));let T=u.length>0?`WHERE id IN (${m}) AND ${u.join(" AND ")}`:`WHERE id IN (${m})`;return this.db.prepare(`
      SELECT * FROM session_summaries
      ${T}
      ORDER BY created_at_epoch ${d}
      ${p}
    `).all(...l)}getUserPromptsByIds(e,s={}){if(e.length===0)return[];let{orderBy:t="date_desc",limit:r,project:o,repoRoot:i,repoId:a}=s,d=t==="date_asc"?"ASC":"DESC",p=r?`LIMIT ${r}`:"",m=e.map(()=>"?").join(","),l=[...e],u=[];a?(u.push(`(
        s.repo_id = ?
        OR (s.repo_id IS NULL AND s.repo_root = ?)
        OR (s.repo_id IS NULL AND s.repo_root IS NULL AND s.project = ?)
      )`),l.push(a,i||"",o||"")):i?(u.push("(s.repo_root = ? OR (s.repo_root IS NULL AND s.project = ?))"),l.push(i,o||"")):o&&(u.push("s.project = ?"),l.push(o));let T=u.length>0?`WHERE up.id IN (${m}) AND ${u.join(" AND ")}`:`WHERE up.id IN (${m})`;return this.db.prepare(`
      SELECT
        up.*,
        s.project,
        s.memory_session_id
      FROM user_prompts up
      JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
      ${T}
      ORDER BY up.created_at_epoch ${d}
      ${p}
    `).all(...l)}getTimelineAroundTimestamp(e,s=10,t=10,r){return this.getTimelineAroundObservation(null,e,s,t,r)}getTimelineAroundObservation(e,s,t=10,r=10,o){let i=o?"AND project = ?":"",a=o?[o]:[],d,p;if(e!==null){let c=`
        SELECT id, created_at_epoch
        FROM observations
        WHERE id <= ? ${i}
        ORDER BY id DESC
        LIMIT ?
      `,b=`
        SELECT id, created_at_epoch
        FROM observations
        WHERE id >= ? ${i}
        ORDER BY id ASC
        LIMIT ?
      `;try{let N=this.db.prepare(c).all(e,...a,t+1),R=this.db.prepare(b).all(e,...a,r+1);if(N.length===0&&R.length===0)return{observations:[],sessions:[],prompts:[]};d=N.length>0?N[N.length-1].created_at_epoch:s,p=R.length>0?R[R.length-1].created_at_epoch:s}catch(N){return _.error("DB","Error getting boundary observations",void 0,{error:N,project:o}),{observations:[],sessions:[],prompts:[]}}}else{let c=`
        SELECT created_at_epoch
        FROM observations
        WHERE created_at_epoch <= ? ${i}
        ORDER BY created_at_epoch DESC
        LIMIT ?
      `,b=`
        SELECT created_at_epoch
        FROM observations
        WHERE created_at_epoch >= ? ${i}
        ORDER BY created_at_epoch ASC
        LIMIT ?
      `;try{let N=this.db.prepare(c).all(s,...a,t),R=this.db.prepare(b).all(s,...a,r+1);if(N.length===0&&R.length===0)return{observations:[],sessions:[],prompts:[]};d=N.length>0?N[N.length-1].created_at_epoch:s,p=R.length>0?R[R.length-1].created_at_epoch:s}catch(N){return _.error("DB","Error getting boundary timestamps",void 0,{error:N,project:o}),{observations:[],sessions:[],prompts:[]}}}let m=`
      SELECT *
      FROM observations
      WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${i}
      ORDER BY created_at_epoch ASC
    `,l=`
      SELECT *
      FROM session_summaries
      WHERE created_at_epoch >= ? AND created_at_epoch <= ? ${i}
      ORDER BY created_at_epoch ASC
    `,u=`
      SELECT up.*, s.project, s.memory_session_id
      FROM user_prompts up
      JOIN sdk_sessions s ON up.content_session_id = s.content_session_id
      WHERE up.created_at_epoch >= ? AND up.created_at_epoch <= ? ${i.replace("project","s.project")}
      ORDER BY up.created_at_epoch ASC
    `,T=this.db.prepare(m).all(d,p,...a),h=this.db.prepare(l).all(d,p,...a),g=this.db.prepare(u).all(d,p,...a);return{observations:T,sessions:h.map(c=>({id:c.id,memory_session_id:c.memory_session_id,project:c.project,request:c.request,completed:c.completed,next_steps:c.next_steps,created_at:c.created_at,created_at_epoch:c.created_at_epoch})),prompts:g.map(c=>({id:c.id,content_session_id:c.content_session_id,prompt_number:c.prompt_number,prompt_text:c.prompt_text,project:c.project,created_at:c.created_at,created_at_epoch:c.created_at_epoch}))}}getPromptById(e){return this.db.prepare(`
      SELECT
        p.id,
        p.content_session_id,
        p.prompt_number,
        p.prompt_text,
        s.project,
        p.created_at,
        p.created_at_epoch
      FROM user_prompts p
      LEFT JOIN sdk_sessions s ON p.content_session_id = s.content_session_id
      WHERE p.id = ?
      LIMIT 1
    `).get(e)||null}getPromptsByIds(e){if(e.length===0)return[];let s=e.map(()=>"?").join(",");return this.db.prepare(`
      SELECT
        p.id,
        p.content_session_id,
        p.prompt_number,
        p.prompt_text,
        s.project,
        p.created_at,
        p.created_at_epoch
      FROM user_prompts p
      LEFT JOIN sdk_sessions s ON p.content_session_id = s.content_session_id
      WHERE p.id IN (${s})
      ORDER BY p.created_at_epoch DESC
    `).all(...e)}getSessionSummaryById(e){return this.db.prepare(`
      SELECT
        id,
        memory_session_id,
        content_session_id,
        project,
        user_prompt,
        request_summary,
        learned_summary,
        status,
        created_at,
        created_at_epoch
      FROM sdk_sessions
      WHERE id = ?
      LIMIT 1
    `).get(e)||null}getOrCreateManualSession(e){let s=`manual-${e}`,t=`manual-content-${e}`;if(this.db.prepare("SELECT memory_session_id FROM sdk_sessions WHERE memory_session_id = ?").get(s))return s;let o=new Date;return this.db.prepare(`
      INSERT INTO sdk_sessions (memory_session_id, content_session_id, project, started_at, started_at_epoch, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `).run(s,t,e,o.toISOString(),o.getTime()),_.info("SESSION","Created manual session",{memorySessionId:s,project:e}),s}close(){this.db.close()}importSdkSession(e){let s=this.db.prepare("SELECT id FROM sdk_sessions WHERE content_session_id = ?").get(e.content_session_id);return s?{imported:!1,id:s.id}:{imported:!0,id:this.db.prepare(`
      INSERT INTO sdk_sessions (
        content_session_id, memory_session_id, project, user_prompt,
        started_at, started_at_epoch, completed_at, completed_at_epoch, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e.content_session_id,e.memory_session_id,e.project,e.user_prompt,e.started_at,e.started_at_epoch,e.completed_at,e.completed_at_epoch,e.status).lastInsertRowid}}importSessionSummary(e){let s=this.db.prepare("SELECT id FROM session_summaries WHERE memory_session_id = ?").get(e.memory_session_id);return s?{imported:!1,id:s.id}:{imported:!0,id:this.db.prepare(`
      INSERT INTO session_summaries (
        memory_session_id, project, request, investigated, learned,
        completed, next_steps, files_read, files_edited, notes,
        prompt_number, discovery_tokens, created_at, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e.memory_session_id,e.project,e.request,e.investigated,e.learned,e.completed,e.next_steps,e.files_read,e.files_edited,e.notes,e.prompt_number,e.discovery_tokens||0,e.created_at,e.created_at_epoch).lastInsertRowid}}importObservation(e){let s=this.db.prepare(`
      SELECT id FROM observations
      WHERE memory_session_id = ? AND title = ? AND created_at_epoch = ?
    `).get(e.memory_session_id,e.title,e.created_at_epoch);return s?{imported:!1,id:s.id}:{imported:!0,id:this.db.prepare(`
      INSERT INTO observations (
        memory_session_id, project, text, type, title, subtitle,
        facts, narrative, concepts, files_read, files_modified,
        prompt_number, discovery_tokens, created_at, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e.memory_session_id,e.project,e.text,e.type,e.title,e.subtitle,e.facts,e.narrative,e.concepts,e.files_read,e.files_modified,e.prompt_number,e.discovery_tokens||0,e.created_at,e.created_at_epoch).lastInsertRowid}}importUserPrompt(e){let s=this.db.prepare(`
      SELECT id FROM user_prompts
      WHERE content_session_id = ? AND prompt_number = ?
    `).get(e.content_session_id,e.prompt_number);return s?{imported:!1,id:s.id}:{imported:!0,id:this.db.prepare(`
      INSERT INTO user_prompts (
        content_session_id, prompt_number, prompt_text,
        created_at, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?)
    `).run(e.content_session_id,e.prompt_number,e.prompt_text,e.created_at,e.created_at_epoch).lastInsertRowid}}};var be=D(require("path"),1);function Re(n){if(!n||n.trim()==="")return _.warn("PROJECT_NAME","Empty cwd provided, using fallback",{cwd:n}),"unknown-project";let e=be.default.basename(n);if(e===""){if(process.platform==="win32"){let t=n.match(/^([A-Z]):\\/i);if(t){let o=`drive-${t[1].toUpperCase()}`;return _.info("PROJECT_NAME","Drive root detected",{cwd:n,projectName:o}),o}}return _.warn("PROJECT_NAME","Root directory detected, using fallback",{cwd:n}),"unknown-project"}return e}var Oe=D(require("path"),1),Ie=require("os");var U=require("fs"),G=require("path");var O=class n{static instance=null;activeMode=null;modesDir;constructor(){let e=Te(),s=[(0,G.join)(e,"modes"),(0,G.join)(e,"..","plugin","modes")],t=s.find(r=>(0,U.existsSync)(r));this.modesDir=t||s[0]}static getInstance(){return n.instance||(n.instance=new n),n.instance}parseInheritance(e){let s=e.split("--");if(s.length===1)return{hasParent:!1,parentId:"",overrideId:""};if(s.length>2)throw new Error(`Invalid mode inheritance: ${e}. Only one level of inheritance supported (parent--override)`);return{hasParent:!0,parentId:s[0],overrideId:e}}isPlainObject(e){return e!==null&&typeof e=="object"&&!Array.isArray(e)}deepMerge(e,s){let t={...e};for(let r in s){let o=s[r],i=e[r];this.isPlainObject(o)&&this.isPlainObject(i)?t[r]=this.deepMerge(i,o):t[r]=o}return t}loadModeFile(e){let s=(0,G.join)(this.modesDir,`${e}.json`);if(!(0,U.existsSync)(s))throw new Error(`Mode file not found: ${s}`);let t=(0,U.readFileSync)(s,"utf-8");return JSON.parse(t)}loadMode(e){let s=this.parseInheritance(e);if(!s.hasParent)try{let d=this.loadModeFile(e);return this.activeMode=d,_.debug("SYSTEM",`Loaded mode: ${d.name} (${e})`,void 0,{types:d.observation_types.map(p=>p.id),concepts:d.observation_concepts.map(p=>p.id)}),d}catch{if(_.warn("SYSTEM",`Mode file not found: ${e}, falling back to 'code'`),e==="code")throw new Error("Critical: code.json mode file missing");return this.loadMode("code")}let{parentId:t,overrideId:r}=s,o;try{o=this.loadMode(t)}catch{_.warn("SYSTEM",`Parent mode '${t}' not found for ${e}, falling back to 'code'`),o=this.loadMode("code")}let i;try{i=this.loadModeFile(r),_.debug("SYSTEM",`Loaded override file: ${r} for parent ${t}`)}catch{return _.warn("SYSTEM",`Override file '${r}' not found, using parent mode '${t}' only`),this.activeMode=o,o}if(!i)return _.warn("SYSTEM",`Invalid override file: ${r}, using parent mode '${t}' only`),this.activeMode=o,o;let a=this.deepMerge(o,i);return this.activeMode=a,_.debug("SYSTEM",`Loaded mode with inheritance: ${a.name} (${e} = ${t} + ${r})`,void 0,{parent:t,override:r,types:a.observation_types.map(d=>d.id),concepts:a.observation_concepts.map(d=>d.id)}),a}getActiveMode(){if(!this.activeMode)throw new Error("No mode loaded. Call loadMode() first.");return this.activeMode}getObservationTypes(){return this.getActiveMode().observation_types}getObservationConcepts(){return this.getActiveMode().observation_concepts}getTypeIcon(e){return this.getObservationTypes().find(t=>t.id===e)?.emoji||"\u{1F4DD}"}getWorkEmoji(e){return this.getObservationTypes().find(t=>t.id===e)?.work_emoji||"\u{1F4DD}"}validateType(e){return this.getObservationTypes().some(s=>s.id===e)}getTypeLabel(e){return this.getObservationTypes().find(t=>t.id===e)?.label||e}};function q(){let n=Oe.default.join((0,Ie.homedir)(),".claude-mem","settings.json"),e=A.loadFromFile(n),s=e.CLAUDE_MEM_MODE,t=s==="code"||s.startsWith("code--"),r,o;if(t)r=new Set(e.CLAUDE_MEM_CONTEXT_OBSERVATION_TYPES.split(",").map(i=>i.trim()).filter(Boolean)),o=new Set(e.CLAUDE_MEM_CONTEXT_OBSERVATION_CONCEPTS.split(",").map(i=>i.trim()).filter(Boolean));else{let i=O.getInstance().getActiveMode();r=new Set(i.observation_types.map(a=>a.id)),o=new Set(i.observation_concepts.map(a=>a.id))}return{totalObservationCount:parseInt(e.CLAUDE_MEM_CONTEXT_OBSERVATIONS,10),fullObservationCount:parseInt(e.CLAUDE_MEM_CONTEXT_FULL_COUNT,10),sessionCount:parseInt(e.CLAUDE_MEM_CONTEXT_SESSION_COUNT,10),showReadTokens:e.CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS==="true",showWorkTokens:e.CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS==="true",showSavingsAmount:e.CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT==="true",showSavingsPercent:e.CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT==="true",observationTypes:r,observationConcepts:o,fullObservationField:e.CLAUDE_MEM_CONTEXT_FULL_FIELD,showLastSummary:e.CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY==="true",showLastMessage:e.CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE==="true"}}var E={reset:"\x1B[0m",bright:"\x1B[1m",dim:"\x1B[2m",cyan:"\x1B[36m",green:"\x1B[32m",yellow:"\x1B[33m",blue:"\x1B[34m",magenta:"\x1B[35m",gray:"\x1B[90m",red:"\x1B[31m"},fe=4,K=1;function z(n){let e=(n.title?.length||0)+(n.subtitle?.length||0)+(n.narrative?.length||0)+JSON.stringify(n.facts||[]).length;return Math.ceil(e/fe)}function J(n){let e=n.length,s=n.reduce((i,a)=>i+z(a),0),t=n.reduce((i,a)=>i+(a.discovery_tokens||0),0),r=t-s,o=t>0?Math.round(r/t*100):0;return{totalObservations:e,totalReadTokens:s,totalDiscoveryTokens:t,savings:r,savingsPercent:o}}function Ds(n){return O.getInstance().getWorkEmoji(n)}function v(n,e){let s=z(n),t=n.discovery_tokens||0,r=Ds(n.type),o=t>0?`${r} ${t.toLocaleString()}`:"-";return{readTokens:s,discoveryTokens:t,discoveryDisplay:o,workEmoji:r}}function $(n){return n.showReadTokens||n.showWorkTokens||n.showSavingsAmount||n.showSavingsPercent}var Ce=D(require("path"),1),B=require("fs");function Q(n,e,s){let t=Array.from(s.observationTypes),r=t.map(()=>"?").join(","),o=Array.from(s.observationConcepts),i=o.map(()=>"?").join(",");return n.db.prepare(`
    SELECT
      id, memory_session_id, type, title, subtitle, narrative,
      facts, concepts, files_read, files_modified, discovery_tokens,
      created_at, created_at_epoch
    FROM observations
    WHERE project = ?
      AND type IN (${r})
      AND EXISTS (
        SELECT 1 FROM json_each(concepts)
        WHERE value IN (${i})
      )
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(e,...t,...o,s.totalObservationCount)}function Z(n,e,s){return n.db.prepare(`
    SELECT id, memory_session_id, request, investigated, learned, completed, next_steps, created_at, created_at_epoch
    FROM session_summaries
    WHERE project = ?
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(e,s.sessionCount+K)}function Ae(n,e,s){let t=Array.from(s.observationTypes),r=t.map(()=>"?").join(","),o=Array.from(s.observationConcepts),i=o.map(()=>"?").join(","),a=e.map(()=>"?").join(",");return n.db.prepare(`
    SELECT
      id, memory_session_id, type, title, subtitle, narrative,
      facts, concepts, files_read, files_modified, discovery_tokens,
      created_at, created_at_epoch, project
    FROM observations
    WHERE project IN (${a})
      AND type IN (${r})
      AND EXISTS (
        SELECT 1 FROM json_each(concepts)
        WHERE value IN (${i})
      )
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(...e,...t,...o,s.totalObservationCount)}function Le(n,e,s){let t=e.map(()=>"?").join(",");return n.db.prepare(`
    SELECT id, memory_session_id, request, investigated, learned, completed, next_steps, created_at, created_at_epoch, project
    FROM session_summaries
    WHERE project IN (${t})
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(...e,s.sessionCount+K)}function Ms(n){return n.replace(/\//g,"-")}function ys(n){try{if(!(0,B.existsSync)(n))return{userMessage:"",assistantMessage:""};let e=(0,B.readFileSync)(n,"utf-8").trim();if(!e)return{userMessage:"",assistantMessage:""};let s=e.split(`
`).filter(r=>r.trim()),t="";for(let r=s.length-1;r>=0;r--)try{let o=s[r];if(!o.includes('"type":"assistant"'))continue;let i=JSON.parse(o);if(i.type==="assistant"&&i.message?.content&&Array.isArray(i.message.content)){let a="";for(let d of i.message.content)d.type==="text"&&(a+=d.text);if(a=a.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g,"").trim(),a){t=a;break}}}catch(o){_.debug("PARSER","Skipping malformed transcript line",{lineIndex:r},o);continue}return{userMessage:"",assistantMessage:t}}catch(e){return _.failure("WORKER","Failed to extract prior messages from transcript",{transcriptPath:n},e),{userMessage:"",assistantMessage:""}}}function ee(n,e,s,t){if(!e.showLastMessage||n.length===0)return{userMessage:"",assistantMessage:""};let r=n.find(d=>d.memory_session_id!==s);if(!r)return{userMessage:"",assistantMessage:""};let o=r.memory_session_id,i=Ms(t),a=Ce.default.join(L,"projects",i,`${o}.jsonl`);return ys(a)}function ve(n,e){let s=e[0]?.id;return n.map((t,r)=>{let o=r===0?null:e[r+1];return{...t,displayEpoch:o?o.created_at_epoch:t.created_at_epoch,displayTime:o?o.created_at:t.created_at,shouldShowLink:t.id!==s}})}function se(n,e){let s=[...n.map(t=>({type:"observation",data:t})),...e.map(t=>({type:"summary",data:t}))];return s.sort((t,r)=>{let o=t.type==="observation"?t.data.created_at_epoch:t.data.displayEpoch,i=r.type==="observation"?r.data.created_at_epoch:r.data.displayEpoch;return o-i}),s}function De(n,e){return new Set(n.slice(0,e).map(s=>s.id))}function Me(){let n=new Date,e=n.toLocaleDateString("en-CA"),s=n.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0}).toLowerCase().replace(" ",""),t=n.toLocaleTimeString("en-US",{timeZoneName:"short"}).split(" ").pop();return`${e} ${s} ${t}`}function ye(n){return[`# [${n}] recent context, ${Me()}`,""]}function Ue(){return[`**Legend:** session-request | ${O.getInstance().getActiveMode().observation_types.map(s=>`${s.emoji} ${s.id}`).join(" | ")}`,""]}function ke(){return["**Column Key**:","- **Read**: Tokens to read this observation (cost to learn it now)","- **Work**: Tokens spent on work that produced this record ( research, building, deciding)",""]}function Xe(){return["**Context Index:** This semantic index (titles, types, files, tokens) is usually sufficient to understand past work.","","When you need implementation details, rationale, or debugging context:","- Fetch by ID: get_observations([IDs]) for observations visible in this index","- Search history: Use the mem-search skill for past decisions, bugs, and deeper research","- Trust this index over re-reading code for past decisions and learnings",""]}function xe(n,e){let s=[];if(s.push("**Context Economics**:"),s.push(`- Loading: ${n.totalObservations} observations (${n.totalReadTokens.toLocaleString()} tokens to read)`),s.push(`- Work investment: ${n.totalDiscoveryTokens.toLocaleString()} tokens spent on research, building, and decisions`),n.totalDiscoveryTokens>0&&(e.showSavingsAmount||e.showSavingsPercent)){let t="- Your savings: ";e.showSavingsAmount&&e.showSavingsPercent?t+=`${n.savings.toLocaleString()} tokens (${n.savingsPercent}% reduction from reuse)`:e.showSavingsAmount?t+=`${n.savings.toLocaleString()} tokens`:t+=`${n.savingsPercent}% reduction from reuse`,s.push(t)}return s.push(""),s}function we(n){return[`### ${n}`,""]}function Fe(n){return[`**${n}**`,"| ID | Time | T | Title | Read | Work |","|----|------|---|-------|------|------|"]}function Pe(n,e,s){let t=n.title||"Untitled",r=O.getInstance().getTypeIcon(n.type),{readTokens:o,discoveryDisplay:i}=v(n,s),a=s.showReadTokens?`~${o}`:"",d=s.showWorkTokens?i:"";return`| #${n.id} | ${e||'"'} | ${r} | ${t} | ${a} | ${d} |`}function Ge(n,e,s,t){let r=[],o=n.title||"Untitled",i=O.getInstance().getTypeIcon(n.type),{readTokens:a,discoveryDisplay:d}=v(n,t);r.push(`**#${n.id}** ${e||'"'} ${i} **${o}**`),s&&(r.push(""),r.push(s),r.push(""));let p=[];return t.showReadTokens&&p.push(`Read: ~${a}`),t.showWorkTokens&&p.push(`Work: ${d}`),p.length>0&&r.push(p.join(", ")),r.push(""),r}function $e(n,e){let s=`${n.request||"Session started"} (${e})`;return[`**#S${n.id}** ${s}`,""]}function k(n,e){return e?[`**${n}**: ${e}`,""]:[]}function Be(n){return n.assistantMessage?["","---","","**Previously**","",`A: ${n.assistantMessage}`,""]:[]}function He(n,e){return["",`Access ${Math.round(n/1e3)}k tokens of past research & decisions for just ${e.toLocaleString()}t. Use the claude-mem skill to access memories by ID.`]}function je(n){return`# [${n}] recent context, ${Me()}

No previous sessions found for this project yet.`}function We(){let n=new Date,e=n.toLocaleDateString("en-CA"),s=n.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0}).toLowerCase().replace(" ",""),t=n.toLocaleTimeString("en-US",{timeZoneName:"short"}).split(" ").pop();return`${e} ${s} ${t}`}function Ve(n){return["",`${E.bright}${E.cyan}[${n}] recent context, ${We()}${E.reset}`,`${E.gray}${"\u2500".repeat(60)}${E.reset}`,""]}function Ye(){let e=O.getInstance().getActiveMode().observation_types.map(s=>`${s.emoji} ${s.id}`).join(" | ");return[`${E.dim}Legend: session-request | ${e}${E.reset}`,""]}function qe(){return[`${E.bright}Column Key${E.reset}`,`${E.dim}  Read: Tokens to read this observation (cost to learn it now)${E.reset}`,`${E.dim}  Work: Tokens spent on work that produced this record ( research, building, deciding)${E.reset}`,""]}function Ke(){return[`${E.dim}Context Index: This semantic index (titles, types, files, tokens) is usually sufficient to understand past work.${E.reset}`,"",`${E.dim}When you need implementation details, rationale, or debugging context:${E.reset}`,`${E.dim}  - Fetch by ID: get_observations([IDs]) for observations visible in this index${E.reset}`,`${E.dim}  - Search history: Use the mem-search skill for past decisions, bugs, and deeper research${E.reset}`,`${E.dim}  - Trust this index over re-reading code for past decisions and learnings${E.reset}`,""]}function ze(n,e){let s=[];if(s.push(`${E.bright}${E.cyan}Context Economics${E.reset}`),s.push(`${E.dim}  Loading: ${n.totalObservations} observations (${n.totalReadTokens.toLocaleString()} tokens to read)${E.reset}`),s.push(`${E.dim}  Work investment: ${n.totalDiscoveryTokens.toLocaleString()} tokens spent on research, building, and decisions${E.reset}`),n.totalDiscoveryTokens>0&&(e.showSavingsAmount||e.showSavingsPercent)){let t="  Your savings: ";e.showSavingsAmount&&e.showSavingsPercent?t+=`${n.savings.toLocaleString()} tokens (${n.savingsPercent}% reduction from reuse)`:e.showSavingsAmount?t+=`${n.savings.toLocaleString()} tokens`:t+=`${n.savingsPercent}% reduction from reuse`,s.push(`${E.green}${t}${E.reset}`)}return s.push(""),s}function Je(n){return[`${E.bright}${E.cyan}${n}${E.reset}`,""]}function Qe(n){return[`${E.dim}${n}${E.reset}`]}function Ze(n,e,s,t){let r=n.title||"Untitled",o=O.getInstance().getTypeIcon(n.type),{readTokens:i,discoveryTokens:a,workEmoji:d}=v(n,t),p=s?`${E.dim}${e}${E.reset}`:" ".repeat(e.length),m=t.showReadTokens&&i>0?`${E.dim}(~${i}t)${E.reset}`:"",l=t.showWorkTokens&&a>0?`${E.dim}(${d} ${a.toLocaleString()}t)${E.reset}`:"";return`  ${E.dim}#${n.id}${E.reset}  ${p}  ${o}  ${r} ${m} ${l}`}function es(n,e,s,t,r){let o=[],i=n.title||"Untitled",a=O.getInstance().getTypeIcon(n.type),{readTokens:d,discoveryTokens:p,workEmoji:m}=v(n,r),l=s?`${E.dim}${e}${E.reset}`:" ".repeat(e.length),u=r.showReadTokens&&d>0?`${E.dim}(~${d}t)${E.reset}`:"",T=r.showWorkTokens&&p>0?`${E.dim}(${m} ${p.toLocaleString()}t)${E.reset}`:"";return o.push(`  ${E.dim}#${n.id}${E.reset}  ${l}  ${a}  ${E.bright}${i}${E.reset}`),t&&o.push(`    ${E.dim}${t}${E.reset}`),(u||T)&&o.push(`    ${u} ${T}`),o.push(""),o}function ss(n,e){let s=`${n.request||"Session started"} (${e})`;return[`${E.yellow}#S${n.id}${E.reset} ${s}`,""]}function X(n,e,s){return e?[`${s}${n}:${E.reset} ${e}`,""]:[]}function ts(n){return n.assistantMessage?["","---","",`${E.bright}${E.magenta}Previously${E.reset}`,"",`${E.dim}A: ${n.assistantMessage}${E.reset}`,""]:[]}function rs(n,e){let s=Math.round(n/1e3);return["",`${E.dim}Access ${s}k tokens of past research & decisions for just ${e.toLocaleString()}t. Use the claude-mem skill to access memories by ID.${E.reset}`]}function ns(n){return`
${E.bright}${E.cyan}[${n}] recent context, ${We()}${E.reset}
${E.gray}${"\u2500".repeat(60)}${E.reset}

${E.dim}No previous sessions found for this project yet.${E.reset}
`}function os(n,e,s,t){let r=[];return t?r.push(...Ve(n)):r.push(...ye(n)),t?r.push(...Ye()):r.push(...Ue()),t?r.push(...qe()):r.push(...ke()),t?r.push(...Ke()):r.push(...Xe()),$(s)&&(t?r.push(...ze(e,s)):r.push(...xe(e,s))),r}var te=D(require("path"),1);function W(n){if(!n)return[];try{let e=JSON.parse(n);return Array.isArray(e)?e:[]}catch(e){return _.debug("PARSER","Failed to parse JSON array, using empty fallback",{preview:n?.substring(0,50)},e),[]}}function as(n){return new Date(n).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:!0})}function ds(n){return new Date(n).toLocaleString("en-US",{hour:"numeric",minute:"2-digit",hour12:!0})}function _s(n){return new Date(n).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric"})}function is(n,e){return te.default.isAbsolute(n)?te.default.relative(e,n):n}function Es(n,e,s){let t=W(n);if(t.length>0)return is(t[0],e);if(s){let r=W(s);if(r.length>0)return is(r[0],e)}return"General"}function Us(n){let e=new Map;for(let t of n){let r=t.type==="observation"?t.data.created_at:t.data.displayTime,o=_s(r);e.has(o)||e.set(o,[]),e.get(o).push(t)}let s=Array.from(e.entries()).sort((t,r)=>{let o=new Date(t[0]).getTime(),i=new Date(r[0]).getTime();return o-i});return new Map(s)}function ks(n,e){return e.fullObservationField==="narrative"?n.narrative:n.facts?W(n.facts).join(`
`):null}function Xs(n,e,s,t,r,o){let i=[];o?i.push(...Je(n)):i.push(...we(n));let a=null,d="",p=!1;for(let m of e)if(m.type==="summary"){p&&(i.push(""),p=!1,a=null,d="");let l=m.data,u=as(l.displayTime);o?i.push(...ss(l,u)):i.push(...$e(l,u))}else{let l=m.data,u=Es(l.files_modified,r,l.files_read),T=ds(l.created_at),h=T!==d,g=h?T:"";d=T;let c=s.has(l.id);if(u!==a&&(p&&i.push(""),o?i.push(...Qe(u)):i.push(...Fe(u)),a=u,p=!0),c){let b=ks(l,t);o?i.push(...es(l,T,h,b,t)):(p&&!o&&(i.push(""),p=!1),i.push(...Ge(l,g,b,t)),a=null)}else o?i.push(Ze(l,T,h,t)):i.push(Pe(l,g,t))}return p&&i.push(""),i}function ps(n,e,s,t,r){let o=[],i=Us(n);for(let[a,d]of i)o.push(...Xs(a,d,e,s,t,r));return o}function ms(n,e,s){return!(!n.showLastSummary||!e||!!!(e.investigated||e.learned||e.completed||e.next_steps)||s&&e.created_at_epoch<=s.created_at_epoch)}function ls(n,e){let s=[];return e?(s.push(...X("Investigated",n.investigated,E.blue)),s.push(...X("Learned",n.learned,E.yellow)),s.push(...X("Completed",n.completed,E.green)),s.push(...X("Next Steps",n.next_steps,E.magenta))):(s.push(...k("Investigated",n.investigated)),s.push(...k("Learned",n.learned)),s.push(...k("Completed",n.completed)),s.push(...k("Next Steps",n.next_steps))),s}function us(n,e){return e?ts(n):Be(n)}function cs(n,e,s){return!$(e)||n.totalDiscoveryTokens<=0||n.savings<=0?[]:s?rs(n.totalDiscoveryTokens,n.totalReadTokens):He(n.totalDiscoveryTokens,n.totalReadTokens)}var xs=Ts.default.join((0,gs.homedir)(),".claude","plugins","marketplaces","thedotmack","plugin",".install-version");function ws(){try{return new P}catch(n){if(n.code==="ERR_DLOPEN_FAILED"){try{(0,Ns.unlinkSync)(xs)}catch(e){_.debug("SYSTEM","Marker file cleanup failed (may not exist)",{},e)}return _.error("SYSTEM","Native module rebuild needed - restart Claude Code to auto-fix"),null}throw n}}function Fs(n,e){return e?ns(n):je(n)}function Ps(n,e,s,t,r,o,i){let a=[],d=J(e);a.push(...os(n,d,t,i));let p=s.slice(0,t.sessionCount),m=ve(p,s),l=se(e,m),u=De(e,t.fullObservationCount);a.push(...ps(l,u,t,r,i));let T=s[0],h=e[0];ms(t,T,h)&&a.push(...ls(T,i));let g=ee(e,t,o,r);return a.push(...us(g,i)),a.push(...cs(d,t,i)),a.join(`
`).trimEnd()}async function re(n,e=!1){let s=q(),t=n?.cwd??process.cwd(),r=Re(t),o=n?.projects||[r],i=ws();if(!i)return"";try{let a=o.length>1?Ae(i,o,s):Q(i,r,s),d=o.length>1?Le(i,o,s):Z(i,r,s);return a.length===0&&d.length===0?Fs(r,e):Ps(r,a,d,s,t,n?.session_id,e)}finally{i.close()}}0&&(module.exports={generateContext});
