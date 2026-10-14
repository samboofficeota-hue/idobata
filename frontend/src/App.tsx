import { Suspense, lazy } from "react";
import type { ReactNode } from "react";
import { Navigate, Outlet, createBrowserRouter } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import PageLayout from "./components/layout/PageLayout";
import { AuthProvider } from "./contexts/AuthContext";
import { MockProvider } from "./contexts/MockContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import About from "./pages/About";
import CommentsPage from "./pages/CommentsPage";
import DataPage from "./pages/DataPage";
import Forum from "./pages/Forum";
import HowTo from "./pages/HowTo";
import KouchouCreate from "./pages/KouchouCreate";
import KouchouReportDetail from "./pages/KouchouReportDetail";
import KouchouReports from "./pages/KouchouReports";
import MainPage from "./pages/MainPage";
import MyPage from "./pages/MyPage";
import NotFound from "./pages/NotFound";
import QuestionDetail from "./pages/QuestionDetail";
import ThemeDetail from "./pages/ThemeDetail";
import Themes from "./pages/Themes";
import Top from "./pages/Top";

function App() {
  return <Outlet />;
}

// いどばた会議室の画面は、開いたときだけ読み込む
const KaigiTop = lazy(() => import("./pages/KaigiTop"));
const KaigiCreate = lazy(() => import("./pages/KaigiCreate"));
const KaigiRoom = lazy(() => import("./pages/KaigiRoom"));
const KaigiWall = lazy(() => import("./pages/KaigiWall"));

const LazyPage = ({ children }: { children: ReactNode }) => (
  <PageLayout>
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8 text-center">
          読み込み中...
        </div>
      }
    >
      {children}
    </Suspense>
  </PageLayout>
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ThemeProvider>
        <AuthProvider>
          <MockProvider>
            <App />
          </MockProvider>
        </AuthProvider>
      </ThemeProvider>
    ),
    children: [
      { index: true, element: <Navigate to="/top" replace /> },
      {
        path: "legacy",
        element: <AppLayout />,
        children: [
          { index: true, element: <MainPage /> },
          { path: "data", element: <DataPage /> },
          { path: "*", element: <Navigate to="/old" replace /> },
        ],
      },
      {
        path: "top",
        element: (
          <PageLayout>
            <Top />
          </PageLayout>
        ),
      },
      {
        path: "forum",
        element: (
          <PageLayout>
            <Forum />
          </PageLayout>
        ),
      },
      {
        path: "about",
        element: (
          <PageLayout>
            <About />
          </PageLayout>
        ),
      },
      {
        path: "howto",
        element: (
          <PageLayout>
            <HowTo />
          </PageLayout>
        ),
      },
      {
        path: "themes",
        element: (
          <PageLayout>
            <Themes />
          </PageLayout>
        ),
      },
      {
        path: "themes/:themeId",
        element: (
          <PageLayout>
            <ThemeDetail />
          </PageLayout>
        ),
      },
      {
        path: "themes/:themeId/questions/:qId",
        element: (
          <PageLayout>
            <QuestionDetail />
          </PageLayout>
        ),
      },
      {
        path: "themes/:themeId/questions/:qId/comments",
        element: (
          <PageLayout>
            <CommentsPage />
          </PageLayout>
        ),
      },
      {
        path: "kouchou",
        element: (
          <PageLayout>
            <KouchouReports />
          </PageLayout>
        ),
      },
      {
        path: "kouchou/new",
        element: (
          <PageLayout>
            <KouchouCreate />
          </PageLayout>
        ),
      },
      {
        path: "kouchou/:slug",
        element: (
          <PageLayout>
            <KouchouReportDetail />
          </PageLayout>
        ),
      },
      {
        path: "kaigi",
        element: (
          <LazyPage>
            <KaigiTop />
          </LazyPage>
        ),
      },
      {
        path: "kaigi/new",
        element: (
          <LazyPage>
            <KaigiCreate />
          </LazyPage>
        ),
      },
      {
        path: "kaigi/:roomId",
        element: (
          <LazyPage>
            <KaigiRoom />
          </LazyPage>
        ),
      },
      {
        path: "kaigi/:roomId/wall",
        element: (
          <LazyPage>
            <KaigiWall />
          </LazyPage>
        ),
      },
      {
        path: "mypage",
        element: (
          <PageLayout>
            <MyPage />
          </PageLayout>
        ),
      },
      {
        path: "*",
        element: (
          <PageLayout>
            <NotFound />
          </PageLayout>
        ),
      },
    ],
  },
]);

export default App;
