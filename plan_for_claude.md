# Canadian Election Policy Tracker Project Plan

## Project Overview
We'll build a system to track and make accessible the policy pronouncements of Canadian federal party leaders during the election campaign. The end product will be an interactive chat interface powered by OpenAI's Assistants API allowing voters to query and compare party positions.

## Workstream 1: Data Collection System

### Data Sources:
- Twitter (using existing scraper in `scrapers/scrape_tweets.sh`)
- YouTube transcripts
- Press releases
- Campaign websites

### Tasks:
- Build YouTube transcript extraction tools
- Create press release collection system
- Develop campaign website scrapers
- Set up scheduled data collection jobs
- Implement data validation and source verification
- Create process for outside contributors to add source documents

### Deliverables:
- Data collection scripts for each source
- Contributor submission process

## Workstream 2: Data Processing and Cleaning

### Tasks:
- Develop text cleaning pipelines
- Convert collected data to clean markdown documents
- Create data standardization processes
- Enhance existing PDF upload script (`openai_utils/upload_pdfs_to_vector_store.py`) to handle markdown files

### Deliverables:
- Text processing scripts
- Clean, standardized markdown documents
- Updated document upload system

## Workstream 3: OpenAI Integration

### Tasks:
- Upload processed documents to OpenAI's vector store
- Configure Assistants API
- Develop prompt engineering templates
- Create response formatting guidelines
- Implement conversation memory and context management
- Build citation and source tracking

### Deliverables:
- Data integration scripts
- Configured Assistant
- Prompt templates
- Response formatting code

## Workstream 4: Frontend Development

### Tasks:
- Design user interface
- Create responsive web application
- Implement chat interface
- Develop comparison visualization tools
- Build search functionality

### Deliverables:
- Web application code
- Interactive chat system
- Comparison visualizations

## Workstream 5: Deployment

### Tasks:
- Set up production environment
- Deploy application
- Configure monitoring tools
- Create user documentation

### Deliverables:
- Deployment scripts
- Live application
- User documentation

## Technical Stack
- **Backend**: Python (FastAPI or Django)
- **Data Processing**: Python (NLTK, pandas)
- **AI Integration**: OpenAI Assistants API
- **Frontend**: React.js, Next.js
- **Deployment**: AWS or Azure
- **CI/CD**: GitHub Actions

## Key Considerations

### Challenges and Risks
- Ensuring political neutrality in data collection and presentation
- Managing real-time updates during fast-moving campaigns
- Accurately capturing policy positions
- Handling misinformation or contradictory statements
- Scaling during peak usage periods (debates, major announcements)
- Ensuring data privacy and security 