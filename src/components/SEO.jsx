
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { siteConfig } from '../config/siteConfig';

const PAGE_METADATA = {
  '/': {
    title: 'Timeless Trends | Discover Watches & Everyday Classics',
    description:
      'Explore the TIMELESS TRENDS watch catalogue, discover contemporary styles and everyday classics, and enquire directly through WhatsApp.'
  },
  '/shop': {
    title: 'Shop Watches | TIMELESS TRENDS Catalogue',
    description:
      'Browse the TIMELESS TRENDS watch catalogue. Explore watch styles, view product details, and enquire through WhatsApp.'
  },
  '/collections': {
    title: 'Watch Collections | TIMELESS TRENDS',
    description:
      'Explore watch collections from TIMELESS TRENDS and discover styles suited to different tastes and occasions.'
  },
  '/about': {
    title: 'About Us | TIMELESS TRENDS',
    description:
      'Learn about TIMELESS TRENDS, our watch catalogue, and how to enquire about products directly through WhatsApp.'
  },
  '/contact': {
    title: 'Contact & WhatsApp Enquiries | TIMELESS TRENDS',
    description:
      'Contact TIMELESS TRENDS to ask about watches, product availability, and catalogue details through WhatsApp.'
  }
};

function setMeta(attribute, key, content) {
  let element = document.head.querySelector(
    `meta[${attribute}="${key}"]`
  );

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function cleanDescription(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function setCanonical(url) {
  let element = document.head.querySelector(
    'link[rel="canonical"]'
  );

  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }

  element.setAttribute('href', url);
}

export default function SEO({ product }) {
  const location = useLocation();

  useEffect(() => {
    const baseUrl = siteConfig.publicUrl.replace(/\/+$/, '');
    const pathname =
      location.pathname.length > 1
        ? location.pathname.replace(/\/+$/, '')
        : '/';

    const isProductPage = pathname.startsWith('/product/');
    const isAdminPage = pathname.startsWith('/admin');

    if (isAdminPage) {
      document.title = 'Admin | TIMELESS TRENDS';
      setMeta('name', 'robots', 'noindex, nofollow');
      return;
    }

    let title;
    let description;

    if (isProductPage && product) {
      title = `${product.name} | TIMELESS TRENDS`;

      description = cleanDescription(
        product.description ||
          `Explore ${product.name}${product.brand ? ` by ${product.brand}` : ''} in the TIMELESS TRENDS watch catalogue. Contact us on WhatsApp for product enquiries.`
      );
    } else {
      const metadata = PAGE_METADATA[pathname];

      title =
        metadata?.title || 'Watch Catalogue | TIMELESS TRENDS';

      description = cleanDescription(
        metadata?.description ||
          'Explore the TIMELESS TRENDS watch catalogue and contact us for product enquiries.'
      );
    }

    const canonicalUrl = `${baseUrl}${pathname}`;
    const socialImage = `${baseUrl}/images/collections/trending.svg`;

    document.title = title;

    setMeta('name', 'description', description);
    setMeta('name', 'robots', 'index, follow');

    setMeta('property', 'og:type', isProductPage ? 'product' : 'website');
    setMeta('property', 'og:site_name', 'TIMELESS TRENDS');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:image', socialImage);

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', socialImage);

    setCanonical(canonicalUrl);
  }, [
    location.pathname,
    product?.name,
    product?.brand,
    product?.description
  ]);

  return null;
}
