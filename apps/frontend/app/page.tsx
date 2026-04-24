import { ApiTestComponent } from '@/components/api-test';

export default function HomePage() {
  return (
    <div className="bg-background flex min-h-screen w-full flex-col">
      <div className="flex items-center justify-center flex-1 px-4">
        <div className="w-full space-y-8">
          <div className="text-center">
            <h1 className="text-primary text-4xl font-bold">OptiTrade</h1>
            <p className="text-gray-600 mt-2">Backend: REST API & gRPC Integration</p>
          </div>
          <ApiTestComponent />
        </div>
      </div>
    </div>
  );
}
