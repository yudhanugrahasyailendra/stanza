import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import SiteShell from "./components/SiteShell";
import { ThemeProvider } from "./contexts/ThemeContext";
import Explore from "./pages/Explore";
import Write from "./pages/Write";
import Profile from "./pages/Profile";
import Settings from "@/pages/Settings";
import Notifications from "@/pages/Notifications";
import AuthPage from "@/pages/AuthPage";
import Feedback from "@/pages/Feedback";
import { LanguageProvider } from "./contexts/LanguageContext";

function Router() {
  return <SiteShell><Switch>
    <Route path="/" component={Explore} />
    <Route path="/explore" component={Explore} />
    <Route path="/write" component={Write} />
    <Route path="/profile/:username" component={Profile} />
    <Route path="/notifications" component={Notifications} />
    <Route path="/settings" component={Settings} />
    <Route path="/login" component={AuthPage} />
    <Route path="/feedback" component={Feedback} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch></SiteShell>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="system"><LanguageProvider><TooltipProvider><Toaster /><Router /></TooltipProvider></LanguageProvider></ThemeProvider></ErrorBoundary>;
}
