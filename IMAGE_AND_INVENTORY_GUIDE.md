# TIMELESS TRENDS — Product Inventory & Image Guide

This guide explains how to add real watches, genuine photographs, and colour variants to the TIMELESS TRENDS catalogue.

---

## 1. How to Add Genuine Watch Product Images

1. Place your real watch product photos into the folder:
   ```
   public/images/products/
   ```
2. Recommended photography settings:
   - **Aspect Ratio:** 4:5 (e.g., `1200 x 1500 px` or `800 x 1000 px`).
   - **Background:** Clean off-white (`#F7F5F0`), neutral soft grey, or matte black (`#141414`).
   - **Format:** `.webp`, `.jpg`, or `.png`.
   - **Lighting:** Controlled rim lighting so case edges and bezel details are crisp.
   - **Preserve:** Keep original watch dial, hands, logos, and subdials authentic. Never alter the genuine design of the watch.

3. Name your image files clearly, for example:
   - `omega-speedmaster-main.jpg`
   - `omega-speedmaster-dial-closeup.jpg`
   - `omega-speedmaster-black-strap.jpg`
   - `omega-speedmaster-steel-bracelet.jpg`

---

## 2. How to Add or Update Products in `src/data/products.js`

Open `src/data/products.js` and add a new entry to the `products` array:

```javascript
{
  id: 'TT-YOUR-MODEL-01',                       // Unique product ID
  slug: 'brand-model-watch-name',               // Clean, URL-friendly unique slug
  name: 'Brand Model Watch Name',               // Display title
  brand: 'Confirmed Brand Name',                // Brand (or omit if unconfirmed)
  model: 'Model Ref 1234',                      // Model number (or null)
  price: 2999,                                  // Numeric INR price, OR null for "Price on request"
  originalPrice: 3599,                          // Real discounted original price, OR null
  category: 'Trending & Modern',                // 'Everyday Classics', 'Trending & Modern', "Men's Collection", "Women's Collection"
  description: 'Editorial description of the timepiece aesthetics and build.',
  mainImage: '/images/products/your-watch-main.jpg',
  additionalImages: [
    '/images/products/your-watch-angle.jpg',
    '/images/products/your-watch-back.jpg'
  ],
  variants: [
    {
      id: 'var-1',
      name: 'Black Dial & Silver Steel',
      color: '#1A1A1A',                         // Hex color for swatch circle
      image: '/images/products/your-watch-black.jpg',
      available: true
    },
    {
      id: 'var-2',
      name: 'Blue Dial & Silver Steel',
      color: '#0A2540',
      image: '/images/products/your-watch-blue.jpg',
      available: true
    }
  ],
  specifications: {                             // Only include CONFIRMED specs
    'Case Diameter': '41 mm',
    'Case Material': '316L Stainless Steel',
    'Glass': 'Sapphire Crystal',
    'Water Resistance': '50M / 5 ATM'
  },
  featured: true,                               // true to feature on homepage
  isNewArrival: true,                           // true to display "New Arrival" badge
  availability: 'Available'                     // "Available", "Limited Edition", or null
}
```

---

## 3. How to Set Your Official WhatsApp Business Number

1. Open `src/config/siteConfig.js`.
2. Locate the line:
   ```javascript
   whatsappNumber: '',
   ```
3. Enter your international phone number **without** `+`, spaces, or dashes.
   - For an Indian number `+91 98765 43210`, enter:
     ```javascript
     whatsappNumber: '919876543210',
     ```
4. Save the file. All "Enquire on WhatsApp" buttons will immediately open WhatsApp directly with prefilled watch details.

---

## 4. How to Set Your Public Production Domain

1. Open `src/config/siteConfig.js`.
2. Locate `publicUrl`:
   ```javascript
   publicUrl: 'https://timelesstrends.com',
   ```
3. Enter your live website URL (e.g. `https://yourdomain.com`).
4. **Note:** Keep this empty during local development (`localhost`) so test URLs are never included in customer messages.
