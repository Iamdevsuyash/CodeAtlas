
import React from 'react';
import AnalyzerSection from './AnalyzerSection';
import TrendingSection from './TrendingSection';
import RelatedSection from './RelatedSection';
import DevToolsSection from './DevToolsSection';
import IdeasSection from './IdeasSection';
import MessagesSection from './MessagesSection';
import ProjectsSection from './ProjectsSection';
import Header from './Header';
import ApiHubSection from './ApiHubSection';

const ContentArea = ({ activeSection, selectedRepo, onAnalyzeRepo, onShareIdea }) => {
    const renderSection = () => {
        switch (activeSection) {
            case 'analyzer':
                return <AnalyzerSection selectedRepo={selectedRepo} />;
            case 'trending':
                return <TrendingSection onAnalyze={onAnalyzeRepo} onShareIdea={onShareIdea} />;
            case 'related':
                return <RelatedSection />;
            case 'devtools':
                return <DevToolsSection />;
            case 'apihub':
                return <ApiHubSection />;
            case 'ideas':
                return <IdeasSection />;
            case 'messages':
                return <MessagesSection />;
            case 'projects':
                return <ProjectsSection />;
            default:
                return <AnalyzerSection selectedRepo={selectedRepo} />;
        }
    };

    return (
        <div className="content-area">
            <Header />
            {renderSection()}
        </div>
    );
};

export default ContentArea; 