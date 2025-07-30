
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

const ContentArea = ({ activeSection }) => {
    const renderSection = () => {
        switch (activeSection) {
            case 'analyzer':
                return <AnalyzerSection />;
            case 'trending':
                return <TrendingSection />;
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
                return <AnalyzerSection />;
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