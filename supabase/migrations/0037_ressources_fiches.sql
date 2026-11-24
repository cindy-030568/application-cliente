-- =====================================================================
-- Ressources : en plus des liens (Drive, PDF…), des fiches écrites
-- directement dans l'appli, que la coach modifie quand elle veut.
-- Une ressource peut rester en brouillon (non publiée) : les clientes ne la voient pas.
-- + Brouillon de la fiche « Je mange dehors » (à relire et publier par la coach).
-- =====================================================================

alter table public.ressources
  alter column url drop not null,
  add column contenu text check (contenu is null or length(contenu) <= 20000),
  add column publiee boolean not null default true,
  add constraint ressources_lien_ou_fiche check (url is not null or contenu is not null);

-- Les clientes ne voient que les ressources publiées.
drop policy ressources_lecture on public.ressources;
create policy ressources_lecture on public.ressources
  for select to authenticated
  using (
    (select public.est_coach())
    or (
      publiee
      and (select public.acces_ouvert())
      and (
        visibilite = 'toutes'
        or exists (
          select 1 from public.ressources_clientes rc
          where rc.ressource_id = ressources.id and rc.cliente_id = (select auth.uid())
        )
      )
    )
  );

-- Proposition de contenu « Je mange dehors » : en brouillon, jamais visible tant que la coach ne l'a pas publiée.
insert into public.ressources (titre, categorie_id, description, contenu, publiee, visibilite)
select
  'Je mange dehors',
  (select id from public.categories_ressource where nom = 'Fiches pratiques' limit 1),
  'Restaurant, boulangerie, chez des amis : profiter, sans culpabiliser et sans tout remettre en question.',
  $fiche$Manger dehors fait partie de la vie, et ton accompagnement est fait pour s'adapter à ta vie, pas l'inverse. Un repas au restaurant, un sandwich sur le pouce ou un dîner chez des amis ne « gâche » rien. Ce qui compte, c'est ce que tu fais la plupart du temps, pas un repas isolé.

Voici quelques repères simples pour choisir sereinement, sans te priver.

## Avant de partir

- **Ne saute pas le repas d'avant** pour « compenser » : tu arriverais affamée, et c'est là qu'on mange sans y penser.
- Si le repas est tard, une petite collation (un fruit, un yaourt, quelques amandes) t'aide à arriver sereine.
- Bois un grand verre d'eau avant de partir.

## Au restaurant

- **Commence par regarder ce qui te fait vraiment envie.** Le plaisir fait partie du repas : choisis un plat que tu as envie de manger, pas celui que tu « devrais » prendre.
- Repère les trois briques de ton assiette : **une source de protéines** (viande, poisson, œufs, tofu, légumineuses), **des légumes**, et **un féculent**. Si l'une manque, tu peux simplement demander : « avec des légumes à la place des frites ? » ou « une portion de légumes en plus ? ». C'est une demande normale, les restaurants y sont habitués.
- Les sauces et l'assaisonnement à part, c'est une option si tu veux doser toi-même, jamais une obligation.
- **Entrée, plat ou dessert ?** Choisis ce qui te fait plaisir ce jour-là. Si le dessert te fait de l'œil, prends-le et savoure-le, ou partage-le.
- Le pain est bon : profite-en, sans forcément finir la corbeille par automatisme.
- Mange lentement, pose ta fourchette entre deux bouchées, et écoute ta faim : tu as le droit de laisser quelques bouchées si tu n'as plus faim.

## À la boulangerie ou sur le pouce

- Un **sandwich** au pain complet ou aux céréales avec une garniture protéinée (poulet, thon, œuf, jambon, fromage) et des crudités est un vrai repas.
- Une **salade composée** avec une source de protéines et un féculent (pâtes, riz, quinoa, pain) tient bien au corps.
- Une **quiche ou une part de pizza** ? Accompagne-la d'une salade ou de crudités, et d'un fruit si tu as encore faim.
- La viennoiserie ou la pâtisserie plaisir : choisis celle qui te fait vraiment envie, prends le temps de la manger assise, et savoure.
- Pense à la boisson : une eau, plate ou gazeuse, plutôt qu'un soda par habitude.

## Chez des amis ou en famille

- **Profite du moment** : tu es là pour les gens, pas pour surveiller ton assiette.
- Sers-toi normalement, en commençant par ce qui te fait le plus envie, et ressers-toi si tu as encore faim.
- Tu n'as pas à te justifier ni à expliquer ton accompagnement. Un simple « merci, c'était délicieux, je n'ai plus faim » suffit.
- Tu peux proposer d'apporter un plat que tu aimes : c'est toujours apprécié.

## À l'apéro

- Alterne une boisson alcoolisée et un grand verre d'eau.
- Choisis les bouchées qui te font envie plutôt que de grignoter un peu de tout par automatisme.
- Si l'apéro est dînatoire, c'est ton repas : pas besoin d'en prévoir un autre après.

## Et le lendemain ?

**Rien à compenser.** Tu reprends simplement ton rythme habituel au repas suivant : pas de jeûne, pas de repas « punition », pas de séance en plus pour « éliminer ». Si la balance bouge un peu le lendemain, c'est surtout de l'eau (le sel, les glucides et l'alcool la font varier) : regarde la tendance sur plusieurs semaines.

Un repas plaisir, c'est un repas réussi 💛$fiche$,
  false,
  'toutes'
where not exists (select 1 from public.ressources where titre = 'Je mange dehors');
