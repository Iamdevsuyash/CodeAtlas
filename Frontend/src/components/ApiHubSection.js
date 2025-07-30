import React, { useState } from 'react';

const API_CATEGORIES = [
    {
        label: 'Technology',
        apis: [
            { name: 'GitHub', desc: 'Host and review code, manage projects, and build software.', link: 'https://api.github.com/' },
            { name: 'Stack Exchange', desc: 'Access Q&A for programming and tech topics.', link: 'https://api.stackexchange.com/' },
            { name: 'WolframAlpha', desc: 'Computational knowledge engine for answers and data.', link: 'https://products.wolframalpha.com/api/' },
        ],
    },
    {
        label: 'Coding',
        apis: [
            { name: 'Judge0', desc: 'Online code execution and compilation API.', link: 'https://judge0.com/' },
            { name: 'Codeforces', desc: 'Competitive programming contest and user data.', link: 'https://codeforces.com/apiHelp' },
            { name: 'HackerRank', desc: 'Programming challenges and user data.', link: 'https://www.hackerrank.com/auth/oauth/authorize' },
        ],
    },
    {
        label: 'Music',
        apis: [
            { name: 'Spotify', desc: 'Music catalog, playlists, and user data.', link: 'https://developer.spotify.com/documentation/web-api/' },
            { name: 'Deezer', desc: 'Music streaming and artist data.', link: 'https://developers.deezer.com/api' },
            { name: 'Last.fm', desc: 'Music discovery and user listening data.', link: 'https://www.last.fm/api' },
        ],
    },
    {
        label: 'Sports',
        apis: [
            { name: 'TheSportsDB', desc: 'Crowdsourced database of sports data and scores.', link: 'https://www.thesportsdb.com/api.php' },
            { name: 'Football-Data.org', desc: 'Football (soccer) data and fixtures.', link: 'https://www.football-data.org/documentation/api' },
            { name: 'API-Basketball', desc: 'Basketball data, scores, and stats.', link: 'https://www.api-basketball.com/documentation' },
        ],
    },
    {
        label: 'Science',
        apis: [
            { name: 'NASA', desc: 'Space and astronomy data, images, and news.', link: 'https://api.nasa.gov/' },
            { name: 'Open Notify', desc: 'ISS location and people in space.', link: 'http://open-notify.org/Open-Notify-API/' },
            { name: 'OpenWeatherMap', desc: 'Weather data and forecasts.', link: 'https://openweathermap.org/api' },
        ],
    },
    {
        label: 'News',
        apis: [
            { name: 'NewsAPI', desc: 'News headlines and articles from worldwide sources.', link: 'https://newsapi.org/' },
            { name: 'Currents', desc: 'Latest news published in various blogs, websites and news outlets.', link: 'https://currentsapi.services/en/docs/' },
            { name: 'ContextualWeb News', desc: 'Search and access news articles.', link: 'https://rapidapi.com/contextualwebsearch/api/web-search/' },
        ],
    },
    {
        label: 'Health',
        apis: [
            { name: 'COVID-19 API', desc: 'COVID-19 statistics and data.', link: 'https://covid19api.com/' },
            { name: 'Nutritionix', desc: 'Nutrition data for foods and restaurants.', link: 'https://developer.nutritionix.com/' },
            { name: 'Open Disease Data', desc: 'Disease outbreak data.', link: 'https://disease.sh/' },
        ],
    },
    {
        label: 'Finance',
        apis: [
            { name: 'Alpha Vantage', desc: 'Stock and forex data.', link: 'https://www.alphavantage.co/documentation/' },
            { name: 'CoinGecko', desc: 'Cryptocurrency data and market info.', link: 'https://www.coingecko.com/en/api' },
            { name: 'IEX Cloud', desc: 'Stock market data.', link: 'https://iexcloud.io/docs/api/' },
        ],
    },
    {
        label: 'Games',
        apis: [
            { name: 'RAWG Video Games Database', desc: 'Video game data and discovery.', link: 'https://rawg.io/apidocs' },
            { name: 'IGDB', desc: 'Video game database and metadata.', link: 'https://api-docs.igdb.com/' },
            { name: 'Open Trivia DB', desc: 'Trivia questions and answers.', link: 'https://opentdb.com/api_config.php' },
        ],
    },
    {
        label: 'Weather',
        apis: [
            { name: 'OpenWeatherMap', desc: 'Weather data and forecasts.', link: 'https://openweathermap.org/api' },
            { name: 'Weatherbit', desc: 'Weather data and forecasts.', link: 'https://www.weatherbit.io/api' },
            { name: 'MetaWeather', desc: 'Weather data and forecasts.', link: 'https://www.metaweather.com/api/' },
        ],
    },
];

const ApiHubSection = () => {
    const [selectedCategory, setSelectedCategory] = useState(null);

    return (
        <div className="api-hub-section">
            <h2>API Hub</h2>
            <p>Discover top public APIs for different fields. Click a category to explore!</p>
            {!selectedCategory ? (
                <div className="category-grid">
                    {API_CATEGORIES.map((cat, index) => (
                        <div key={index} className="category-card" onClick={() => setSelectedCategory(cat)}>
                            {cat.label}
                        </div>
                    ))}
                </div>
            ) : (
                <div>
                    <button className="back-button" onClick={() => setSelectedCategory(null)}>
                        &larr; Back to Categories
                    </button>
                    <h3>APIs for: {selectedCategory.label}</h3>
                    <div className="tools-grid">
                        {selectedCategory.apis.length === 0 && (
                            <div className="empty-state">No APIs found for this category.</div>
                        )}
                        {selectedCategory.apis.map((entry, index) => (
                            <div key={index} className="tool-card">
                                <a href={entry.link} target="_blank" rel="noopener noreferrer" className="tool-link">
                                    <div className="tool-title">{entry.name}</div>
                                </a>
                                <div className="tool-desc">{entry.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApiHubSection; 