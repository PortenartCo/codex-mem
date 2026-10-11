# Codex-Mem — protection des donnees et cycle de vie (12 octobre 2026)

**Statut : PREPARATION HORS PRODUCTION.** Ce document accompagne la PR de qualification `security/codex-mem-retention-synthetic-20261012`, empilee sur les PR #1 et #2. Aucune fusion, activation automatique, transmission de donnees Portenart ou engagement financier n'est autorise par ce document.

## 1. Registre des flux et responsabilites

| Source de donnee | Traitement observable | Sensibilite possible | Statut |
|---|---|---|---|
| Codex CLI `notify` / `exec-json` | Evenements normalises avec `payload_json` complet | Codes, prompts, fichiers, noms, secrets, donnees personnelles | INTERDIT sur depots Portenart reels |
| `raw_events` | Historique SQLite brut, horodatage et metadata de depot | Potentiellement CONFIDENTIEL / SECRET | Pilote fictif uniquement |
| `user_prompts`, `sdk_sessions.user_prompt` | Reprises du texte brut + index FTS | Potentiellement CONFIDENTIEL | Pilote fictif uniquement |
| `observations` | Memoire manuelle/synthetisee | Selon contenu | Fictif uniquement ; conservation distincte |
| MCP sur port loopback | Consultation/restitution | Fuite inter-projets ou processus local | Jeton + projet unique + outils limites (PR #2) |
| Sauvegarde SQLite | Export potentiellement complet | Au moins aussi sensible que les sources | Nouvelle preuve de chiffrement fictive uniquement |

**Autorites canoniques Portenart inchangees** : SharePoint pour documents/preuves, Supabase pour donnees structurees, Worker V2 pour orchestration/etats, Cockpit pour supervision/validation. Codex-Mem resterait un **cache de memoire technique non canonique** ; il ne devient ni writer metier, ni sauvegarde officielle ni replica exhaustif.

## 2. Etat des protections et lacunes

| Controle | Etat apres ce lot | Reste a faire avant donnees professionnelles |
|---|---|---|
| Loopback strict, jeton local, projet unique | Teste sur depot fictif | Identite des clients, isolation Windows ACL, rotation/revocation des credentials |
| Pre-filtrage motifs evidents et refus atomique | Teste sur depot fictif | Classification fiable, garanties de minimisation, echantillonnage/validation humaine des sorties |
| Limitation temporelle du **bail de capture** | Max. 7 jours, deja applique | Ne pas confondre bail avec conservation |
| Retention des donnees brutes | 7 jours PROVISOIRES ; apercu + **copie preparee**, source intacte | Arbitrage final de la duree, mechanismes de purge controles, traces et exceptions de conservation |
| Effacement dans une copie SQLite | `secure_delete`, `VACUUM`, `wal_checkpoint` et verification du FTS testes | Rotation/effacement des backups historiques, blocs SSD, copies/snapshots multiples, preuves d'effacement |
| Export chiffre AES-256-GCM | Demonstration sur **copie synthetique uniquement**, cle ephemeral fournie via env | Stockage/escrow et rotation des cles, restauration hors machine, stockage chiffre de l'original |
| Integrite / restauration | Verif. SQLite et comparaison de SHA-256, source non modifiee | Politique de backup automatisee/heterogene et test de recovery disaster |
| Moteur de synthese | Desactive dans le pilote | Selection du fournisseur, conditions d'usage, frais/quotas et tests qualitatifs |
| Acces depuis ChatGPT/Codex Cloud | Non etabli | Analyse architecturale separee de synchronisation autorisee |

Ne pas declarer ce lot comme certification RGPD ni comme mise en service d'un module de conservation pour les donnees professionnelles.

## 3. Scripts du lot (inertes par defaut)

### `tools/pilots/codex_mem_synthetic_lifecycle.py`

- **preview par defaut** : lit le schema et les compteurs des evenements, prompts et sessions au-dela de la periode synthetique ; n'affiche jamais le contenu des messages ; ne modifie rien.
- **prepare** : exige arret `pilot.stop`, double marqueur `SYNTHETIC_ONLY`, nom de depot `synthetic-*` ou `fixture-*`, accord exact `SYNTHETIC_COPY_ONLY` ; sauvegarde coherente SQLite vers un **nouveau fichier** de `retention-candidates/` ; refuse ecrasement, tables de contenu non qualifiees, pending actif et projet mixte. Les traces brutes expirees, user prompts, references et certaines queues terminees sont retirees uniquement de cette copie ; les observations techniques subsistent.
- Supprimer les lignes dans une copie ne suffit pas a prouver l'absence absolue des memes contenus dans des WAL historiques, fichiers sur disque, caches, modeles tiers, sauvegardes ou logs.
- La copie utilise l'API `sqlite3.backup` plutot qu'une simple copie du fichier principal. Les transactions encore conservees dans le journal SQLite `-wal` sont incluses, et une empreinte combinant base principale + WAL doit rester identique avant/apres. Le test sur une base issue du veritable Worker fictif a confirme cette situation.
- Il n'existe pas d'option de promotion de la copie vers la base active. Une substitution exige une decision humaine et une procedure dediee de reconciliation/restauration.

### `tools/pilots/codex_mem_synthetic_crypto.mjs`

- **encrypt** : accepte une copie SQLite preparee, stocke un nouvel artefact `.cmem` AES-256-GCM authentifie dans `encrypted-backups/`. Cle de 256 bits issue de `CODEX_MEM_PILOT_KEY_HEX`, jamais d'argument CLI ni de fichier secret.
- **restore** : decryptage authentifie vers un fichier **neuf** dans `restore-tests/`, aucune substitution de la base en service.
- Cle necessaire pour la restauration. Si elle est perdue, la sauvegarde peut etre inexploitable. Une variable d'environnement n'est pas un coffre de secrets durable ; les copies produites ici ne constituent pas un plan de reprise.
- Sous Windows, `mode=0600` ne remplace pas une evaluation des ACL NTFS, EFS/BitLocker ni la protection de la memoire des processus.

Les deux outils refusent les fichiers en dehors des dossiers fictifs explicitement balises. Ils n'ont aucune option d'ecriture dans `main`, dans le Codex principal, dans SharePoint/Supabase ou dans une base metier.

## 4. Comparaison des moteurs de synthese — decision economique

| Voie | Cout supplementaire atteste par ce lot | Exposition externe | Verdict actuel |
|---|---|---|---|
| Memoire technique manuelle, validation humaine | Aucun appel de modele supplementaire | Aucune transmission liee au moteur | **Voie a privilegier pour le prochain test** |
| Extraction deterministe de decisions de commits/PR | Aucun appel de modele additionnel ; ne prouve pas la qualite semantique | Selon referentiel GitHub deja autorise | Faisable en futur prototype read-only |
| Reutilisation session Codex authentifiee ChatGPT | Teste une execution ponctuelle, pas un generateur permanent avec garantie tarifaire | Conditions ChatGPT/Codex existantes | **Non certifie pour synthese autonome** |
| LLM local Ollama / autre | Pas de facturation API par nature mais ressources GPU/electricite et temps d'installation | Controle local possible | Option a evaluer ; aucun modele/installation/performance valide |
| Claude SDK / Gemini / OpenRouter du fork | Cle, entitlement et quotas potentiellement requis | Transmission a un prestataire suivant configuration | **Desactive**, pas d'ajout de cle ni de souscription |

La licence AGPL-3.0 declaree dans le depot doit etre revue avant de l'integrer a une distribution ou un service interne qui souleverait des obligations de licence.

## 5. Architecture de la prochaine autorisation

**Etape A — eventuelle memoire technique Portenart** : eviter la capture brute et preferer des fiches courtes **manuellement approuvees**, sans noms, mail, IBAN, prompts originaux, logs ni secrets. Les documents de reference continuent de vivre dans GitHub/SharePoint. Le cache memoire conserve une reference et une interpretation technique minimale, pas les pieces originales.

**Etape B — gouvernance** : determiner finalite et responsable de traitement, classification, necessite d'une AIPD, politique de conservation par type, legitimite/conditions de transfert vers fournisseur, localisation des copies, compte utilisateur et droits du process. Toute sortie publique/tiers ferait l'objet d'un controle de partage adapte.

**Etape C — preuve et gates** : tests anti-fuite avec corpus synthétique representatif, validation des ACL Windows et du chiffrement de stockage actif, sauvegarde restauree hors machine avec cle recouvrable, rollback, audit de cout/qualite du modele et validation humaine avant toute activation sur un depot contenant des informations professionnelles.

**Gate inchangé : HUMAN_REQUIRED / PRODUCTION_NO_GO.** Aucune duree de retention « 7 jours » ne constitue une disposition legale generale ; cette duree sert uniquement au banc fictif et doit etre justifiee ou revisee avant usage reel.
