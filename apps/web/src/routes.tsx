import { createBrowserRouter } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PlaceholderPage } from '@/components/PlaceholderPage';
import { Login } from '@/pages/auth/Login';
import { Dashboard } from '@/pages/dashboard/Dashboard';
import { UsersPage } from '@/pages/settings/UsersPage';
import { PatientListPage } from '@/pages/patients/PatientListPage';
import { PatientForm } from '@/pages/patients/PatientForm';
import { PatientProfilePage } from '@/pages/patients/PatientProfilePage';
import { MedicineListPage } from '@/pages/medicines/MedicineListPage';
import { MedicineForm } from '@/pages/medicines/MedicineForm';
import { TodaysVisitsPage } from '@/pages/visits/TodaysVisitsPage';
import { ConsultationPage } from '@/pages/visits/ConsultationPage';

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/patients', element: <PatientListPage /> },
          { path: '/patients/new', element: <PatientForm /> },
          { path: '/patients/:id', element: <PatientProfilePage /> },
          { path: '/patients/:id/edit', element: <PatientForm /> },
          { path: '/appointments', element: <PlaceholderPage title="Appointments" day="Day 10" /> },
          { path: '/visits', element: <TodaysVisitsPage /> },
          { path: '/visits/:id', element: <ConsultationPage /> },
          { path: '/prescriptions', element: <PlaceholderPage title="Prescriptions" day="Day 6" /> },
          { path: '/medicines', element: <MedicineListPage /> },
          { path: '/medicines/new', element: <MedicineForm /> },
          { path: '/medicines/:id/edit', element: <MedicineForm /> },
          { path: '/follow-up', element: <PlaceholderPage title="Follow-up" day="Day 9" /> },
          { path: '/compliance', element: <PlaceholderPage title="Compliance" day="Day 8" /> },
          { path: '/certificates', element: <PlaceholderPage title="Certificates" day="Day 11" /> },
          { path: '/billing', element: <PlaceholderPage title="Billing" day="Day 12" /> },
          { path: '/accounts', element: <PlaceholderPage title="Accounts" day="Day 12" /> },
          { path: '/reports', element: <PlaceholderPage title="Reports" day="Day 13" /> },
          { path: '/settings', element: <UsersPage /> },
        ],
      },
    ],
  },
]);
