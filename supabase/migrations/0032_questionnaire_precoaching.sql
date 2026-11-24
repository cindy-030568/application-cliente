-- =====================================================================
-- Questionnaire d'arrivée : le questionnaire pré-coaching de Cindy.
-- Remplace les questions de départ de la mise à jour 0031 (les questions
-- ajoutées par la coach sont gardées ; les réponses déjà reçues ne changent pas).
-- Nouveautés : nombre (taille, poids) et date (naissance), qui pré-remplissent
-- ses besoins s'ils sont vides ; « aliments » (liste déjà cochée : elle décoche
-- ce qu'elle ne veut pas et ajoute ce qu'elle veut) ; questions posées seulement
-- aux clientes avec suivi sportif ; texte d'accueil modifiable.
-- =====================================================================

alter table public.questions_arrivee drop constraint if exists questions_arrivee_type_check;
alter table public.questions_arrivee add constraint questions_arrivee_type_check
  check (type in ('texte', 'texte_long', 'choix', 'choix_multiple', 'objectif', 'exclusions', 'nombre', 'date', 'aliments'));
alter table public.questions_arrivee drop constraint if exists questions_arrivee_options_check;
alter table public.questions_arrivee add constraint questions_arrivee_options_check check (cardinality(options) <= 40);
alter table public.questions_arrivee
  -- Champ de ses besoins rempli par la réponse (s'il est vide).
  add column if not exists cible     text check (cible in ('taille_cm', 'poids_kg', 'date_naissance')),
  -- 'sport' : posée seulement aux clientes avec suivi sportif.
  add column if not exists condition text check (condition in ('sport'));

alter table public.reglages add column if not exists questionnaire_intro text check (length(questionnaire_intro) <= 5000);
update public.reglages set questionnaire_intro = 'Félicitations ma Queen ! 👑 Tu fais désormais partie de la team ! 🤩🔥

Tu viens de prendre une décision forte : celle de reprendre le contrôle de ton corps et de ton énergie.

Ce questionnaire est la première étape vers ta nouvelle version. Il va me permettre de comprendre ton profil, tes habitudes, ton mode de vie et tes objectifs afin de construire ta stratégie 100 % personnalisée. Tes réponses me serviront à préparer ton appel de démarrage et poser les bases de ton plan d''action.

Prends quelques minutes pour y répondre le plus complètement et honnêtement possible. Il n''y a aucune bonne ou mauvaise réponse, et tout ce que tu partages ici reste strictement confidentiel. Ta transformation commence maintenant ! 🚀❤️' where questionnaire_intro is null;

-- Les questions de départ (0031) sont remplacées par celles de Cindy.
delete from public.questions_arrivee where libelle in ('Quel est ton objectif principal ?', 'Dans 3 mois, qu''est-ce qui te ferait dire que l''accompagnement a réussi ?', 'Allergies, intolérances ou aliments que tu ne manges pas', 'Combien de repas prends-tu par jour, en général ?', 'Tes habitudes du moment', 'Des aliments que tu adores et que tu veux garder ?', 'Ton rythme de travail', 'Combien d''heures dors-tu par nuit, en moyenne ?', 'Ton niveau de stress en ce moment', 'Quel sport pratiques-tu aujourd''hui, et combien de fois par semaine ?', 'Où vas-tu t''entraîner ?', 'As-tu des douleurs, blessures ou contre-indications ?', 'Ton cycle');

insert into public.questions_arrivee (ordre, section, libelle, aide, type, options, obligatoire, cible, condition) values
  (10, 'Ton profil', 'Ton téléphone', 'Nom, prénom et email sont déjà dans ton espace.', 'texte', array[]::text[], true, null, null),
  (20, 'Ton profil', 'Ta date de naissance', null, 'date', array[]::text[], true, 'date_naissance', null),
  (30, 'Ton profil', 'Ta profession', null, 'texte', array[]::text[], true, null, null),
  (40, 'Ton profil', 'Ta taille (en cm)', null, 'nombre', array[]::text[], true, 'taille_cm', null),
  (50, 'Ton profil', 'Ton poids (en kg)', null, 'nombre', array[]::text[], true, 'poids_kg', null),
  (60, '1. Ton mode de vie et ton quotidien', 'Comment se passe une journée type pour toi, entre le travail et la maison ?', null, 'texte_long', array[]::text[], true, null, null),
  (70, '1. Ton mode de vie et ton quotidien', 'Quel est ton rythme de travail ?', 'Bureau / assise, télétravail, horaires décalés, déplacements…', 'texte', array[]::text[], true, null, null),
  (80, '1. Ton mode de vie et ton quotidien', 'Qui cuisine et fait les courses chez toi ?', null, 'texte', array[]::text[], false, null, null),
  (90, '1. Ton mode de vie et ton quotidien', 'As-tu des enfants ? Si oui, est-ce que cela influence tes repas (horaires, plats communs, restes…) ?', null, 'texte_long', array[]::text[], false, null, null),
  (100, '1. Ton mode de vie et ton quotidien', 'À quelle fréquence manges-tu au restaurant ou lors de repas entre amis / en famille ?', null, 'texte', array[]::text[], false, null, null),
  (110, '2. Tes objectifs et tes motivations', 'Ton objectif principal, en un mot', null, 'objectif', array['Perdre du gras', 'Me sentir mieux sans viser un poids (maintien)', 'Prendre du muscle ou du poids', 'Me tonifier : perdre du gras et gagner du muscle'], true, null, null),
  (120, '2. Tes objectifs et tes motivations', 'Quel est ton objectif principal avec cet accompagnement, et sous quel délai ?', null, 'texte_long', array[]::text[], true, null, null),
  (130, '2. Tes objectifs et tes motivations', 'Quelles sont tes motivations profondes ?', 'Le « pourquoi » derrière ton objectif.', 'texte_long', array[]::text[], true, null, null),
  (140, '2. Tes objectifs et tes motivations', 'Quels sont tes principaux freins aujourd''hui ?', null, 'texte_long', array[]::text[], false, null, null),
  (150, '2. Tes objectifs et tes motivations', 'Sur une échelle de 1 à 10, à quel point es-tu prête à t''investir ? Pourquoi ce chiffre, et pas un de moins ?', null, 'texte_long', array[]::text[], true, null, null),
  (160, '3. Ta santé', 'Es-tu actuellement enceinte ou en période d''allaitement ?', 'Ces questions sont essentielles pour t''accompagner en toute sécurité. Sois la plus précise possible.', 'choix', array['Non', 'Oui, je suis enceinte', 'Oui, j''allaite'], true, null, null),
  (170, '3. Ta santé', 'As-tu une ou plusieurs pathologies ?', 'Ex. : diabète, troubles thyroïdiens, SOPK, hypertension, cholestérol, troubles digestifs… Écris « non » si ce n''est pas le cas.', 'texte_long', array[]::text[], true, null, null),
  (180, '3. Ta santé', 'Suis-tu un traitement médical ? Si oui, lequel ?', null, 'texte', array[]::text[], true, null, null),
  (190, '3. Ta santé', 'Es-tu en pré-ménopause, péri-ménopause ou ménopause ?', null, 'choix', array['Non', 'Pré-ménopause', 'Péri-ménopause', 'Ménopause', 'Je ne sais pas'], false, null, null),
  (200, '3. Ta santé', 'As-tu déjà rencontré, ou rencontres-tu actuellement, des troubles du comportement alimentaire (hyperphagie, compulsions, boulimie, anorexie), diagnostiqués ou non ?', 'Aucun jugement ici : cette question m''aide simplement à adapter mon accompagnement et, si besoin, à travailler main dans la main avec les bons professionnels à tes côtés.', 'texte_long', array[]::text[], false, null, null),
  (210, '3. Ta santé', 'As-tu des douleurs, des blessures ou des limitations physiques ?', null, 'texte', array[]::text[], true, null, null),
  (220, '3. Ta santé', 'Combien d''heures dors-tu en moyenne par nuit ?', null, 'texte', array[]::text[], false, null, null),
  (230, '3. Ta santé', 'Ressens-tu du stress de manière chronique ?', null, 'choix', array['Non', 'Parfois', 'Oui'], false, null, null),
  (240, '3. Ta santé', 'As-tu réalisé un bilan sanguin durant les 6 derniers mois ?', 'Si oui, envoie-le-moi par message.', 'choix', array['Non', 'Oui'], false, null, null),
  (250, '4. Ton alimentation actuelle', 'Quelles sont tes habitudes et contraintes alimentaires ?', 'Végétarienne, sans gluten, sans lactose…', 'texte', array[]::text[], false, null, null),
  (260, '4. Ton alimentation actuelle', 'Combien de repas manges-tu par jour, et à quels horaires ?', null, 'texte', array[]::text[], true, null, null),
  (270, '4. Ton alimentation actuelle', 'Préfères-tu un petit-déjeuner salé ou sucré ?', null, 'choix', array['Salé', 'Sucré', 'Les deux', 'Je ne prends pas de petit-déjeuner'], false, null, null),
  (280, '4. Ton alimentation actuelle', 'As-tu des allergies ou des aversions alimentaires ?', 'Coche ce qui te concerne : les recettes qui en contiennent ne te seront pas proposées.', 'exclusions', array[]::text[], false, null, null),
  (290, '4. Ton alimentation actuelle', 'Comptes-tu tes calories et / ou tes macronutriments ?', null, 'choix', array['Non', 'Oui, les calories', 'Oui, les macronutriments', 'Oui, les deux'], false, null, null),
  (300, '4. Ton alimentation actuelle', 'Arrives-tu à boire suffisamment dans la journée ?', null, 'choix', array['Oui', 'Pas toujours', 'Non'], false, null, null),
  (310, '4. Ton alimentation actuelle', 'Consommes-tu de l''alcool ? Si oui, à quelle fréquence ?', null, 'texte', array[]::text[], false, null, null),
  (320, '4. Ton alimentation actuelle', 'Prends-tu un dessert après les repas ?', null, 'choix', array['Non', 'À chaque repas', 'Midi ou soir'], false, null, null),
  (330, '4. Ton alimentation actuelle', 'Si oui, quel dessert le plus souvent ?', null, 'texte', array[]::text[], false, null, null),
  (340, '4. Ton alimentation actuelle', 'Prends-tu une collation ou un goûter ?', null, 'choix', array['Non', 'Plutôt sucré', 'Plutôt salé'], false, null, null),
  (350, '4. Ton alimentation actuelle', 'Si oui, que manges-tu généralement ?', null, 'texte', array[]::text[], false, null, null),
  (360, '4. Ton alimentation actuelle', 'Consommes-tu des compléments alimentaires (whey, vitamines…) ?', 'Si oui, envoie-moi par message une photo du produit et de ses valeurs nutritionnelles.', 'texte', array[]::text[], false, null, null),
  (370, '4. Ton alimentation actuelle', 'As-tu déjà suivi un coaching alimentaire ou fait un régime ? Si oui, lesquels, et pourquoi ça n''a pas tenu selon toi ?', null, 'texte_long', array[]::text[], false, null, null),
  (380, '5. Ta relation à la nourriture', 'Grignotes-tu entre les repas ? Si oui, dans quelles situations (stress, fatigue, ennui, le soir…) ?', 'Ces réponses m''aident à comprendre ce qui se joue vraiment au quotidien. Sois honnête, sans te juger.', 'texte_long', array[]::text[], false, null, null),
  (390, '5. Ta relation à la nourriture', 'Y a-t-il des moments où tu manges plus que tu ne le voudrais ? Lesquels, et à quelle fréquence ?', null, 'texte_long', array[]::text[], false, null, null),
  (400, '5. Ta relation à la nourriture', 'Comment décrirais-tu ta relation à la nourriture aujourd''hui ?', null, 'texte_long', array[]::text[], true, null, null),
  (410, '6. Ton activité physique', 'Pratiques-tu une activité physique ? Si oui, laquelle et à quelle fréquence ?', null, 'texte', array[]::text[], true, null, null),
  (420, '6. Ton activité physique', 'Si non, es-tu prête à réintégrer une activité physique en douceur ?', null, 'choix', array['Oui', 'Pas encore', 'Je pratique déjà'], false, null, null),
  (430, '6. Ton activité physique', 'Combien de pas fais-tu en moyenne par jour ?', null, 'texte', array[]::text[], false, null, null),
  (440, '6. Ton activité physique', 'T''entraînes-tu en salle ou chez toi ?', null, 'choix', array['En salle', 'Chez moi', 'Les deux'], false, null, 'sport'),
  (450, '6. Ton activité physique', 'Si à domicile, détaille tout le matériel dont tu disposes (avec les charges)', null, 'texte_long', array[]::text[], false, null, 'sport'),
  (460, '7. Ton plan alimentaire', 'Protéines & bases', 'Il n''y aura absolument aucun aliment interdit dans ton plan alimentaire. Décoche les aliments que tu ne veux pas, et ajoute ceux que tu veux voir dans ton plan au quotidien.', 'aliments', array['Œufs', 'Jambon', 'Blanc de poulet', 'Blanc de dinde'], false, null, null),
  (470, '7. Ton plan alimentaire', 'Produits laitiers', null, 'aliments', array['Skyr', 'Fromage blanc', 'Petits suisses', 'Yaourt grec', 'Yaourt nature', 'Cottage cheese'], false, null, null),
  (480, '7. Ton plan alimentaire', 'Lipides', null, 'aliments', array['Avocat', 'Saumon fumé', 'Truite fumée'], false, null, null),
  (490, '7. Ton plan alimentaire', 'Fromages', null, 'aliments', array['Fromage à tartiner', 'Ricotta', 'Comté', 'Brie', 'Camembert', 'Fromage de chèvre', 'Emmental', 'Parmesan'], false, null, null),
  (500, '7. Ton plan alimentaire', 'Oléagineux & graines', null, 'aliments', array['Noix de cajou', 'Amandes', 'Noix de macadamia', 'Beurre de cacahuète', 'Graines de chia'], false, null, null),
  (510, '7. Ton plan alimentaire', 'Fruits secs', null, 'aliments', array['Dattes', 'Figues séchées', 'Abricots secs', 'Raisins secs'], false, null, null),
  (520, '7. Ton plan alimentaire', 'Fruits frais', null, 'aliments', array['Banane', 'Pomme', 'Poire', 'Orange', 'Clémentine', 'Kiwi', 'Fraises', 'Framboises', 'Fruits rouges', 'Mangue', 'Melon', 'Pastèque'], false, null, null),
  (530, '7. Ton plan alimentaire', 'Viandes', null, 'aliments', array['Poulet', 'Dinde', 'Veau', 'Porc', 'Agneau', 'Bœuf'], false, null, null),
  (540, '7. Ton plan alimentaire', 'Poissons', null, 'aliments', array['Thon', 'Saumon', 'Truite', 'Maquereau', 'Sardines', 'Cabillaud', 'Merlu', 'Colin', 'Lieu noir', 'Dorade', 'Crevettes'], false, null, null),
  (550, '7. Ton plan alimentaire', 'Féculents', null, 'aliments', array['Riz', 'Pâtes', 'Boulgour', 'Quinoa', 'Sarrasin', 'Pommes de terre', 'Patates douces', 'Semoule', 'Flocons d''avoine', 'Pain'], false, null, null),
  (560, '7. Ton plan alimentaire', 'Légumineuses', null, 'aliments', array['Haricots rouges', 'Haricots blancs', 'Pois chiches', 'Lentilles'], false, null, null),
  (570, 'Pour finir', 'As-tu des questions ou observations ?', null, 'texte_long', array[]::text[], false, null, null);

-- Envoi : en plus, taille, poids et date de naissance pré-remplissent ses besoins s'ils sont vides.
drop function if exists public.envoyer_questionnaire(jsonb, uuid[], text);
create or replace function public.envoyer_questionnaire(p_reponses jsonb, p_categories uuid[] default '{}', p_objectif text default null, p_besoins jsonb default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (select auth.uid());
  v_taille numeric;
  v_poids numeric;
  v_naissance date;
begin
  if not exists (select 1 from public.clientes where id = v_id and statut <> 'fermee') then
    raise exception 'réservé aux clientes' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_reponses) is distinct from 'array' or jsonb_array_length(p_reponses) > 150 then
    raise exception 'réponses illisibles' using errcode = 'check_violation';
  end if;
  insert into public.reponses_arrivee (cliente_id, reponses) values (v_id, p_reponses) on conflict (cliente_id) do nothing;
  if not found then return false; end if;
  insert into public.exclusions (cliente_id, categorie_id)
    select v_id, c.id from public.categories_aliment c where c.id = any (coalesce(p_categories, '{}'))
  on conflict (cliente_id, categorie_id) where categorie_id is not null do nothing;
  -- Valeurs hors limites ignorées (la coach les saisit elle-même).
  begin v_taille := (p_besoins->>'taille_cm')::numeric; exception when others then v_taille := null; end;
  begin v_poids := (p_besoins->>'poids_kg')::numeric; exception when others then v_poids := null; end;
  begin v_naissance := (p_besoins->>'date_naissance')::date; exception when others then v_naissance := null; end;
  if v_taille not between 100 and 230 then v_taille := null; end if;
  if v_poids not between 25 and 350 then v_poids := null; end if;
  if v_naissance <= date '1900-01-01' or v_naissance > (now() at time zone 'Europe/Paris')::date - interval '10 years' then v_naissance := null; end if;
  insert into public.besoins_clientes (cliente_id, objectif, taille_cm, poids_kg, date_naissance)
  values (v_id, case when p_objectif in ('perte', 'maintien', 'prise', 'recompo') then p_objectif end, v_taille, v_poids, v_naissance)
  on conflict (cliente_id) do update set
    objectif = coalesce(public.besoins_clientes.objectif, excluded.objectif),
    taille_cm = coalesce(public.besoins_clientes.taille_cm, excluded.taille_cm),
    poids_kg = coalesce(public.besoins_clientes.poids_kg, excluded.poids_kg),
    date_naissance = coalesce(public.besoins_clientes.date_naissance, excluded.date_naissance);
  return true;
end;
$$;
revoke execute on function public.envoyer_questionnaire(jsonb, uuid[], text, jsonb) from public, anon;
grant execute on function public.envoyer_questionnaire(jsonb, uuid[], text, jsonb) to authenticated;
