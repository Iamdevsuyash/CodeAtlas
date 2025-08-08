# 🚀 CodeAtlas Cloud Deployment Guide

Deploy CodeAtlas across multiple cloud platforms for optimal performance and scalability.

## 📋 Deployment Architecture

- **Frontend**: Netlify (React App)
- **Backend**: Render (Flask API + PostgreSQL)  
- **Real-time**: Render (Gun.js Server)

## 🔧 Prerequisites

1. **GitHub Account** with your CodeAtlas repository
2. **Netlify Account** (free tier available)
3. **Render Account** (free tier available)
4. **API Keys**:
   - GitHub Personal Access Token
   - Google Gemini API Key

## 📱 Step 1: Deploy Frontend to Netlify

### 1.1 Connect Repository
1. Go to [Netlify](https://netlify.com) and sign in
2. Click "New site from Git"
3. Connect your GitHub account
4. Select your CodeAtlas repository
5. Configure build settings:
   - **Base directory**: `Frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `Frontend/build`

### 1.2 Environment Variables
In Netlify dashboard → Site settings → Environment variables:
```
REACT_APP_API_URL=https://your-backend-app.onrender.com
REACT_APP_GUN_URL=https://your-gunjs-app.onrender.com
```

### 1.3 Custom Domain (Optional)
- Go to Domain settings
- Add your custom domain
- Configure DNS settings

## 🖥️ Step 2: Deploy Backend to Render

### 2.1 Create Web Service
1. Go to [Render](https://render.com) and sign in
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure service:
   - **Name**: `codeatlas-backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python backend1.py`

### 2.2 Environment Variables
In Render dashboard → Environment:
```
FLASK_ENV=production
GITHUB_TOKEN=your_github_token_here
GEMINI_API_KEY=your_gemini_api_key_here
SECRET_KEY=your_secret_key_here
CORS_ORIGINS=https://your-netlify-app.netlify.app
DATABASE_URL=postgresql://user:password@host:port/dbname
```

### 2.3 Add PostgreSQL Database
1. In Render dashboard → "New" → "PostgreSQL"
2. Name: `codeatlas-db`
3. Copy the connection string to `DATABASE_URL` in backend environment

## 🔄 Step 3: Deploy Gun.js Server to Render

### 3.1 Create Separate Web Service
1. Create another Web Service in Render
2. Same repository, different configuration:
   - **Name**: `codeatlas-gunjs`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### 3.2 Environment Variables
```
NODE_ENV=production
CORS_ORIGINS=https://your-netlify-app.netlify.app
PORT=10000
```

## 🔗 Step 4: Update Frontend URLs

After deploying backend and Gun.js server:

1. Update Netlify environment variables with actual URLs:
```
REACT_APP_API_URL=https://codeatlas-backend.onrender.com
REACT_APP_GUN_URL=https://codeatlas-gunjs.onrender.com
```

2. Update backend CORS_ORIGINS:
```
CORS_ORIGINS=https://your-netlify-app.netlify.app,https://your-custom-domain.com
```

## 🧪 Step 5: Testing Deployment

### 5.1 Health Checks
- Frontend: `https://your-netlify-app.netlify.app`
- Backend: `https://codeatlas-backend.onrender.com/api/health`
- Gun.js: `https://codeatlas-gunjs.onrender.com`

### 5.2 Functionality Tests
1. **Repository Analysis**: Test GitHub repository analysis
2. **Team Collaboration**: Test real-time chat and Kanban
3. **Dependency Graph**: Test interactive file structure visualization

## 🔧 Step 6: Production Optimizations

### 6.1 Netlify Optimizations
- Enable asset optimization
- Configure caching headers
- Set up form handling for contact forms

### 6.2 Render Optimizations
- Use persistent disks for file storage
- Configure health check endpoints
- Set up monitoring and alerts

## 🚨 Troubleshooting

### Common Issues

**CORS Errors**:
- Ensure CORS_ORIGINS includes your Netlify URL
- Check protocol (http vs https)

**Database Connection**:
- Verify DATABASE_URL format
- Check PostgreSQL connection limits

**API Rate Limits**:
- Monitor GitHub API usage
- Implement request caching

**Gun.js Connection**:
- Verify WebSocket support
- Check CORS configuration

## 📊 Monitoring

### Render Monitoring
- Check service logs in Render dashboard
- Set up uptime monitoring
- Monitor resource usage

### Netlify Analytics
- Enable Netlify Analytics
- Monitor build times
- Track deployment frequency

## 💰 Cost Optimization

### Free Tier Limits
- **Netlify**: 100GB bandwidth/month
- **Render**: 750 hours/month per service
- **PostgreSQL**: 1GB storage, 1 million rows

### Scaling Strategy
1. Start with free tiers
2. Monitor usage and performance
3. Upgrade services as needed
4. Consider CDN for static assets

## 🔒 Security Checklist

- [ ] Environment variables secured
- [ ] HTTPS enforced on all services
- [ ] API keys rotated regularly
- [ ] Database access restricted
- [ ] CORS properly configured
- [ ] Rate limiting implemented

## 📞 Support

For deployment issues:
1. Check service logs in respective dashboards
2. Verify environment variables
3. Test API endpoints individually
4. Check GitHub repository permissions

---

🎉 **Your CodeAtlas application is now live and scalable across multiple cloud platforms!**
