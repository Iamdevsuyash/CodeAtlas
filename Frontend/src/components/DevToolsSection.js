
import React from 'react';

const devTools = [
    {
        category: 'Code Editors & IDEs',
        tools: [
            { name: 'Visual Studio Code', description: 'Powerful, free, and open-source code editor with a vast extension marketplace.', link: 'https://code.visualstudio.com/' },
            { name: 'JetBrains Suite (IntelliJ, PyCharm, etc.)', description: 'Intelligent, language-specific IDEs that provide deep code understanding.', link: 'https://www.jetbrains.com/' },
            { name: 'Sublime Text', description: 'A sophisticated and highly performant text editor for code, markup, and prose.', link: 'https://www.sublimetext.com/' },
            { name: 'Neovim', description: 'A hyperextensible, Vim-based text editor focused on usability and extensibility.', link: 'https://neovim.io/' },
        ],
    },
    {
        category: 'Version Control & Collaboration',
        tools: [
            { name: 'Git', description: 'The undisputed standard for distributed version control systems.', link: 'https://git-scm.com/' },
            { name: 'GitHub', description: 'The leading platform for hosting and collaborating on Git repositories.', link: 'https://github.com/' },
            { name: 'GitLab', description: 'A complete DevOps platform, delivered as a single application.', link: 'https://about.gitlab.com/' },
            { name: 'GitKraken', description: 'A visual Git client that makes Git more intuitive and visual.', link: 'https://www.gitkraken.com/' },
        ],
    },
    {
        category: 'API Design & Testing',
        tools: [
            { name: 'Postman', description: 'The industry-standard platform for building, testing, and documenting APIs.', link: 'https://www.postman.com/' },
            { name: 'Insomnia', description: 'A collaborative, open-source API design and testing tool.', link: 'https://insomnia.rest/' },
            { name: 'Swagger', description: 'A suite of tools for designing, building, and documenting RESTful APIs.', link: 'https://swagger.io/' },
        ],
    },
    {
        category: 'Containerization & Virtualization',
        tools: [
            { name: 'Docker', description: 'A platform for developing, shipping, and running applications in containers.', link: 'https://www.docker.com/' },
            { name: 'Kubernetes', description: 'An open-source system for automating deployment, scaling, and management of containerized applications.', link: 'https://kubernetes.io/' },
        ],
    },
    {
        category: 'Project Management & Communication',
        tools: [
            { name: 'Jira', description: 'A popular tool for issue tracking and agile project management.', link: 'https://www.atlassian.com/software/jira' },
            { name: 'Trello', description: 'A simple, card-based project management tool for organizing tasks and workflows.', link: 'https://trello.com/' },
            { name: 'Slack', description: 'The leading messaging platform for team communication and collaboration.', link: 'https://slack.com/' },
            { name: 'Discord', description: 'A versatile communication platform for text, voice, and video chat.', link: 'https://discord.com/' },
        ],
    },
];

const DevToolsSection = () => {
    return (
        <div className="dev-tools-section">
            <h2>Essential Developer Tools</h2>
            <p className="dev-tools-intro">
                A curated list of top-tier tools to streamline your development workflow and boost productivity.
            </p>
            {devTools.map((category, index) => (
                <div key={index} className="tool-category">
                    <h3>{category.category}</h3>
                    <div className="tools-grid">
                        {category.tools.map((tool, toolIndex) => (
                            <div key={toolIndex} className="tool-card">
                                <a href={tool.link} target="_blank" rel="noopener noreferrer" className="tool-link">
                                    <div className="tool-title">{tool.name}</div>
                                </a>
                                <div className="tool-desc">{tool.description}</div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default DevToolsSection; 