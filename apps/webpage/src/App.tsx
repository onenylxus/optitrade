import { useState } from 'react';
import { ProjectIntroductionPage } from './pages/ProjectIntroductionPage';
import { ProgressReportPage } from './pages/ProgressReportPage';

function App() {
  const [currentPage, setCurrentPage] = useState<'intro' | 'progress'>('intro');

  return (
    <>
      {currentPage === 'intro' ? (
        <ProjectIntroductionPage
          onNavigate={(page) => setCurrentPage(page as 'intro' | 'progress')}
        />
      ) : (
        <ProgressReportPage onNavigate={(page) => setCurrentPage(page as 'intro' | 'progress')} />
      )}
    </>
  );
}

export default App;
