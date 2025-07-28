import React from 'react';
import Sidebar from '../components/Sidebar';
import ContentArea from '../components/ContentArea';

const HomePage = () => {
    const [activeSection, setActiveSection] = React.useState('analyzer');

    return (
        <div className="App">
            <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />
            <div className="main-layout">
                <ContentArea activeSection={activeSection} />
            </div>
        </div>
    );
};
export default HomePage; 