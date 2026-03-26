# taguardian.fr — Shopify Dev Store

Faux site e-commerce mode/lifestyle en français, basé sur le thème Dawn. Sert de terrain de test pour le snippet Korvus sur Shopify.

**Store** : [taguardian-fr.myshopify.com](https://admin.shopify.com/store/taguardian-fr)
**GTM ID** : GTM-NZ545JC5

---

## Prérequis

- Shopify CLI installé : `brew tap shopify/shopify && brew install shopify-cli`
- Être connecté au store : `shopify auth login --store taguardian-fr.myshopify.com`

---

## Dev local

Lance un serveur de prévisualisation synchronisé avec le store :

```bash
cd taguardian-theme
shopify theme dev --store taguardian-fr.myshopify.com
```

Ouvre automatiquement `http://127.0.0.1:9292` avec hot-reload.

---

## Push du thème

```bash
cd taguardian-theme
shopify theme push --store taguardian-fr.myshopify.com
```

Ou via le script d'automatisation depuis la racine :

```bash
chmod +x setup.sh
./setup.sh
```

---

## Importer les produits

1. Admin Shopify → **Produits** → **Importer**
2. Sélectionner `products.csv`
3. Cocher « Remplacer les produits existants » si nécessaire
4. Cliquer sur **Importer**

Le CSV contient 40 produits répartis en 5 catégories avec variantes (tailles S/M/L/XL pour les vêtements, pointures 36–45 pour les chaussures, couleurs pour les accessoires).

---

## Créer les collections

Depuis Admin → **Contenu** → **Collections** → **Créer une collection**, créez 5 collections automatiques avec les conditions suivantes :

| Nom de la collection | Type       | Condition (tag égal à) |
|----------------------|------------|------------------------|
| Vêtements femme      | Automatique | `vêtements-femme`     |
| Vêtements homme      | Automatique | `vêtements-homme`     |
| Accessoires          | Automatique | `accessoires`         |
| Chaussures           | Automatique | `chaussures`          |
| Maison & Déco        | Automatique | `maison-deco`         |

Les produits seront automatiquement associés grâce aux tags définis dans `products.csv`.

---

## Injection Korvus

Le fichier `layout/theme.liquid` contient le point d'insertion officiel :

```liquid
<!-- INJECT_SCRIPTS -->
{% comment %}Korvus snippet — inject here{% endcomment %}
```

Pour injecter le snippet Korvus, ajoutez-le juste avant ou après ce commentaire.

---

## GTM

Le snippet GTM (ID `GTM-NZ545JC5`) est déjà injecté dans `layout/theme.liquid` :
- Script dans le `<head>` (avant `</head>`)
- Noscript `<iframe>` juste après `<body>`

---

## Configurer le domaine taguardian.fr

1. Admin Shopify → **Paramètres** → **Domaines** → **Ajouter un domaine existant**
2. Saisir `taguardian.fr`
3. Shopify fournit les valeurs DNS :
   - Enregistrement **A** : `@` → IP Shopify (ex. `23.227.38.65`)
   - Enregistrement **CNAME** : `www` → `shops.myshopify.com`
4. Dans l'espace OVH : [ovh.com/manager](https://www.ovh.com/manager/) → Domaines → taguardian.fr → Zone DNS
5. Remplacer les enregistrements A et CNAME existants
6. Retourner dans Shopify → **Vérifier la connexion**

> La propagation DNS peut prendre jusqu'à 48h.

---

## Structure des fichiers

```
shopify/taguardian-fr/
├── taguardian-theme/     ← Thème Dawn modifié (layout/theme.liquid avec GTM + INJECT_SCRIPTS)
├── products.csv          ← 40 produits mode/lifestyle avec variantes
├── collections.csv       ← 5 collections
├── setup.sh              ← Script d'automatisation (push thème + instructions)
└── README.md             ← Ce fichier
```
