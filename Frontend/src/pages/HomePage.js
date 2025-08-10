import React from 'react';
import Sidebar from '../components/Sidebar';
import ContentArea from '../components/ContentArea';

const HomePage = () => {
    const [activeSection, setActiveSection] = React.useState('trending');
    const [selectedRepo, setSelectedRepo] = React.useState(null);

    const handleAnalyzeRepo = (repo) => {
        setSelectedRepo(repo);
        setActiveSection('analyzer');
    };

    const handleShareIdea = () => {
        setActiveSection('ideas');
    };

    return (
        <div className="App">
            <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />
            <div className="main-layout">
                <ContentArea 
                    activeSection={activeSection} 
                    selectedRepo={selectedRepo}
                    onAnalyzeRepo={handleAnalyzeRepo}
                    onShareIdea={handleShareIdea}
                />
            </div>
        </div>
    );
};
export default HomePage; 