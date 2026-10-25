import SEO from './components/SEO';
import React, { useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  useLocation
} from 'react-router-dom';

import { Header } from './components/Header';
import { Footer } from './components/Footer';

import { Home } from './pages/Home';
import { Shop } from './pages/Shop';
import { ProductDetails } from './pages/ProductDetails';
import { Collections } from './pages/Collections';
import { About } from './pages/About';
import { Contact } from './pages/Contact';
import { NotFound } from './pages/NotFound';

// Admin imports
import Login from './admin/pages/Login';
import AdminLayout from './admin/AdminLayout';
import DashboardOverview from './admin/pages/DashboardOverview';
import ProductsList from './admin/pages/ProductsList';
import ProductEditor from './admin/pages/ProductEditor';
import InventoryManagement from './admin/pages/InventoryManagement';
import CategoriesManagement from './admin/pages/CategoriesManagement';
import NewArrivalsManagement from './admin/pages/NewArrivalsManagement';
import OffersManagement from './admin/pages/OffersManagement';
import MediaLibrary from './admin/pages/MediaLibrary';
import InquiriesManagement from './admin/pages/InquiriesManagement';
import AdminsManagement from './admin/pages/AdminsManagement';
import ActivityLogs from './admin/pages/ActivityLogs';
import SettingsManagement from './admin/pages/SettingsManagement';

import './styles/variables.css';
import './styles/global.css';
import './styles/components.css';

/**
 * Scroll to top when navigating between pages.
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

/**
 * Public website layout.
 * Header and Footer appear ONLY on public pages.
 */

function PublicLayout() {
  const location = useLocation();
  const isProductPage = location.pathname.startsWith('/product/');

  return (
    <div className="app-container">
      {!isProductPage && <SEO />}

      <Header />

      <main>
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}


export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />

      <Routes>
        {/* Public website */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/product/:slug" element={<ProductDetails />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Admin login — separate from public website */}
        <Route path="/admin/login" element={<Login />} />

        {/* Protected admin dashboard */}
        <Route path="/admin/*" element={<AdminLayout />}>
          <Route path="dashboard" element={<DashboardOverview />} />
          <Route path="products" element={<ProductsList />} />
          <Route path="products/new" element={<ProductEditor />} />
          <Route path="products/:id/edit" element={<ProductEditor />} />
          <Route path="inventory" element={<InventoryManagement />} />
          <Route path="categories" element={<CategoriesManagement />} />
          <Route path="new-arrivals" element={<NewArrivalsManagement />} />
          <Route path="offers" element={<OffersManagement />} />
          <Route path="media" element={<MediaLibrary />} />
          <Route path="inquiries" element={<InquiriesManagement />} />
          <Route path="admins" element={<AdminsManagement />} />
          <Route path="activity-logs" element={<ActivityLogs />} />
          <Route path="settings" element={<SettingsManagement />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;