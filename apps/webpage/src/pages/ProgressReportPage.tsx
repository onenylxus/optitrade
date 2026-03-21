import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Clock, AlertCircle, Code, Server, Zap } from 'lucide-react';

export function ProgressReportPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <div className="min-h-screen bg-linear-to-br from-background to-muted/20">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">OptiTrade</h1>
          <div className="space-x-4">
            <Button variant="outline" onClick={() => onNavigate('intro')}>
              Home
            </Button>
            <Button variant="ghost" onClick={() => onNavigate('progress')}>
              Progress Report
            </Button>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">Progress Report</h2>
          <p className="text-xl text-muted-foreground">
            Track the development progress of OptiTrade Copilot
          </p>
        </div>
      </section>

      {/* Overall Stats */}
      <section className="max-w-6xl mx-auto px-4 mb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold text-primary">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Milestones */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h3 className="text-3xl font-bold text-foreground mb-8">Development Milestones</h3>
        <div className="space-y-6">
          {milestones.map((milestone, index) => (
            <Card key={index} className={milestone.completed ? 'border-green-500/50' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {milestone.completed ? (
                      <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="w-6 h-6 text-yellow-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <CardTitle>{milestone.title}</CardTitle>
                      <CardDescription>{milestone.description}</CardDescription>
                    </div>
                  </div>
                  <span
                    className={`text-sm font-medium px-3 py-1 rounded-full whitespace-nowrap ml-4 ${
                      milestone.completed
                        ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                        : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                    }`}
                  >
                    {milestone.completed ? 'Completed' : 'In Progress'}
                  </span>
                </div>
              </CardHeader>
              {milestone.details && (
                <CardContent className="pt-0">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {milestone.details.map((detail, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* Components & Services */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h3 className="text-3xl font-bold text-foreground mb-8">Components & Services</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {components.map((component, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <component.icon className="w-6 h-6 text-primary" />
                  <CardTitle>{component.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">{component.description}</p>
                <div className="space-y-2">
                  {component.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Next Steps */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Zap className="w-6 h-6 text-primary" />
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {nextSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="font-bold text-primary">
                    {String(index + 1).padStart(2, '0')}.
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ul>
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

const stats = [
  { label: 'Project Completion', value: '65%' },
  { label: 'Components Built', value: '12+' },
  { label: 'Team Members', value: '1' },
];

const milestones = [
  {
    title: 'Project Setup & Architecture',
    description: 'Initialized monorepo with Nx, set up project structure',
    completed: true,
    details: [
      'Created Nx monorepo workspace',
      'Set up backend (Python), frontend (Next.js), and e2e testing',
      'Configured TypeScript and ESLint',
    ],
  },
  {
    title: 'Frontend Development',
    description: 'Building the main trading portal interface',
    completed: true,
    details: [
      'Implemented Next.js with Tailwind CSS',
      'Created shadcn/ui component library integration',
      'Built dashboard layout and base widgets',
    ],
  },
  {
    title: 'Backend API Development',
    description: 'Creating gRPC services and business logic',
    completed: true,
    details: [
      'Set up Python backend with gRPC',
      'Implemented hello world example service',
      'Created unit tests with pytest',
    ],
  },
  {
    title: 'Interactive Canvas Implementation',
    description: 'Building real-time visualization system',
    completed: false,
    details: [
      'Design canvas architecture',
      'Implement drawing and interaction libraries',
      'Create real-time updates with WebSocket',
    ],
  },
  {
    title: 'AI Integration',
    description: 'Integrating machine learning models',
    completed: false,
    details: [
      'Develop ML model pipeline',
      'Create prediction APIs',
      'Optimize inference performance',
    ],
  },
  {
    title: 'E2E Testing & Deployment',
    description: 'Complete testing suite and production deployment',
    completed: false,
    details: [
      'Add Playwright e2e tests',
      'Set up CI/CD pipeline',
      'Deploy to production environment',
    ],
  },
];

const components = [
  {
    icon: Server,
    name: 'Backend (Python)',
    description: 'gRPC services with Python implementation',
    features: ['gRPC Services', 'Unit Tests', 'Error Handling', 'Protocol Buffers'],
  },
  {
    icon: Code,
    name: 'Frontend (Next.js)',
    description: 'Modern React application with Next.js',
    features: ['React 19', 'Tailwind CSS', 'shadcn/ui', 'TypeScript'],
  },
  {
    icon: Zap,
    name: 'E2E Testing',
    description: 'Playwright-based end-to-end testing',
    features: ['Playwright', 'Test Coverage', 'CI Integration', 'HTML Reports'],
  },
  {
    icon: AlertCircle,
    name: 'DevOps',
    description: 'Infrastructure and deployment automation',
    features: ['Nx Cloud', 'GitHub Actions', 'Docker Ready', 'Type Checking'],
  },
];

const nextSteps = [
  'Complete interactive canvas implementation for real-time data visualization',
  'Integrate AI/ML models for trading signal generation',
  'Implement WebSocket communication for live market updates',
  'Add user authentication and authorization system',
  'Deploy beta version to staging environment',
  'Conduct user testing and gather feedback',
  'Final polish and production deployment',
];
