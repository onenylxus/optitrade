import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, TrendingUp, Brain, Zap } from 'lucide-react';

export function ProjectIntroductionPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <div className="min-h-screen bg-linear-to-br from-background to-muted/20">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">OptiTrade</h1>
          <div className="space-x-4">
            <Button variant="ghost" onClick={() => onNavigate('intro')}>
              Home
            </Button>
            <Button variant="outline" onClick={() => onNavigate('progress')}>
              Progress Report
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="space-y-6 mb-12">
          <h2 className="text-5xl md:text-6xl font-bold text-foreground">OptiTrade Copilot</h2>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            An AI-Driven Trading Portal with Interactive Dynamic Canvas
          </p>
        </div>

        <div className="flex justify-center gap-4 mb-20">
          <Button size="lg" onClick={() => onNavigate('progress')}>
            View Progress
          </Button>
          <Button size="lg" variant="outline">
            Learn More
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h3 className="text-3xl font-bold text-foreground mb-8 text-center">Key Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl">About OptiTrade</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-muted-foreground leading-relaxed mb-4">
              OptiTrade is a sophisticated trading platform that combines artificial intelligence
              with interactive visualization to provide traders with actionable insights. Our
              platform leverages advanced algorithms and machine learning to analyze market trends
              and help optimize trading decisions.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Built with modern web technologies and a focus on user experience, OptiTrade delivers
              real-time data visualization, AI-powered analysis, and an intuitive interface for
              traders of all skill levels.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-20 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-muted-foreground">
          <p>&copy; 2026 OptiTrade. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    icon: Brain,
    title: 'AI-Powered',
    description: 'Machine learning algorithms analyze market data in real-time',
  },
  {
    icon: TrendingUp,
    title: 'Market Analysis',
    description: 'Comprehensive trading signals and trend analysis',
  },
  {
    icon: Zap,
    title: 'Fast & Reliable',
    description: 'Lightning-fast execution and 99.9% uptime reliability',
  },
  {
    icon: Sparkles,
    title: 'Advanced UI',
    description: 'Interactive canvas with dynamic visualizations',
  },
];
