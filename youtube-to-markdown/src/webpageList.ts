export interface WebPageInput {
  url: string;
  party_id: number;
  selector?: string; // Optional CSS selector to target specific content
}

// News pages with date filtering
export interface NewsPageInput {
  url: string;
  party_id: number;
  maxPages?: number;
  cutoffDate: string; // Format: 'YYYY-MM-DD'
}

// Party IDs based on our database schema:
// 1: Liberal Party of Canada
// 2: Conservative Party of Canada
// (Other parties removed for simplification)

// Regular webpages to process (policy pages, etc.)
export const webpagesToProcess: WebPageInput[] = [
  // Liberal Party
  // { 
  //   url: 'https://liberal.ca/our-plan/', 
  //   party_id: 1
  // },
  // {
  //   url: 'https://liberal.ca/housing/', 
  //   party_id: 1
  // },
  // {
  //   url: 'https://liberal.ca/economy/', 
  //   party_id: 1
  // },
  // {
  //   url: 'https://liberal.ca/climate-change/', 
  //   party_id: 1
  // },
  
  // // Conservative Party
  // {
  //   url: 'https://www.conservative.ca/plan/', 
  //   party_id: 2
  // },
  // {
  //   url: 'https://www.conservative.ca/lower-taxes-secure-retirement-for-our-seniors/?utm_content=National',
  //   party_id: 2
  // },
  // {
  //   url: 'https://www.conservative.ca/conservative-leader-pierre-poilievre-introduces-the-build-homes-not-bureaucracy-act/', 
  //   party_id: 2
  // },
  // {
  //   url: 'https://www.conservative.ca/poilievre-promises-to-axe-the-carbon-tax-stop-harmful-liberal-regulations-and-let-people-live-their-best-lives/', 
  //   party_id: 2
  // }
]; 

// News pages to process with date filtering
export const newsPagesToProcess: NewsPageInput[] = [
  // Liberal Party news
  {
    url: 'https://liberal.ca/category/media-releases/',
    party_id: 1,
    maxPages: 2,
    cutoffDate: '2025-03-20'
  },
  
  // Conservative Party news
  {
    url: 'https://www.conservative.ca/news/?utm_content=National',
    party_id: 2,
    maxPages: 2,
    cutoffDate: '2025-03-20'
  }
]; 