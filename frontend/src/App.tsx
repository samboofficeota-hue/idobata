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
import MainPage from "./pages/MainPage";
import MyPage from "./pages/MyPage";
import QuestionDetail from "./pages/QuestionDetail";
import ThemeDetail from "./pages/ThemeDetail";
import Themes from "./pages/Themes";
import Top from "./pages/Top";

function App() {
  return <Outlet />;
}

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
        path: "mypage",
        element: (
          <PageLayout>
            <MyPage />
          </PageLayout>
        ),
      },
    ],
  },
]);

export default App;
