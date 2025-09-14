# GOAL  
- your task is to help the user write clean, simple, readable, modular, well-documented code.  
- do exactly what the user asks for, nothing more, nothing less.  
- think hard, like a Senior Developer would.  
  
# ABOUT TAQUERÍA EL APÁ  
- this codebase is for our restaurant management app named "Taquería El Apá"  
- it's a Progressive Web Application for table and order management operations  
- we are a small restaurant with limited resources  
- we CANNOT overthink & over-engineer shit. we have to look for the 80/20 solution.  
  
# MODUS OPERANDI  
- Prioritize simplicity and minimalism in your solutions.  
- Use simple & easy-to-understand language. Write in short sentences.  
  
# TECH STACK  
- Frontend: Vanilla JavaScript, HTML5, CSS3  
- Styling: Tailwind CSS (CDN), Inter font family  
- Storage: localStorage for client-side persistence  
- PWA: Service Worker, Web App Manifest  
- Architecture: Single-page application with drawer/modal interfaces  
  
# DEPLOYED ENVIRONMENTS  
- Production: Served as static files (PWA)  
- Local: Open index.html directly in browser  
  
# DATABASE  
- Client-side only using localStorage  
- Key storage items: tacos_tables, tacos_items, tacos_prices, tacos_promoEnabled  
- No server-side database - everything persists locally in browser  
  
# API  
- No external APIs  
- All data operations through TaqueriaApp namespace  
- State management via AppState object with persist() and loadState() methods  
  
# VERSION CONTROL  
- we use git for version control  
- follow standard git practices for this simple codebase  
  
# ESSENTIAL COMMANDS  
- No build process required  
- To run: Open index.html in web browser  
- To test PWA: Serve files via local HTTP server (python -m http.server)  
- Service worker updates automatically on version changes  
  
# COMMENTS  
- every file should have clear Header Comments at the top, explaining where the file is, and what it does  
- all comments should be clear, simple and easy-to-understand  
- when writing code, make sure to add comments to the most complex / non-obvious parts of the code  
- it is better to add more comments than less  
  
# UI DESIGN PRINCIPLES  
- the UI needs to be simple, clean, and minimalistic for restaurant staff  
- we aim to achieve great UI/UX for quick order management  
- the main colors are yellow/amber (#f59e0b) and gray tones  
- responsive design for both desktop and mobile devices  
  
# HEADER COMMENTS  
- EVERY file HAS TO start with 4 lines of comments!  
1. exact file location in codebase  
2. clear description of what this file does  
3. clear description of WHY this file exists  
4. RELEVANT FILES: comma-separated list of 2-4 most relevant files  
- NEVER delete these "header comments" from the files you're editing.  
  
# SIMPLICITY  
- Always prioritize writing clean, simple, and modular code.  
- do not add unnecessary complications. SIMPLE = GOOD, COMPLEX = BAD.  
- Implement precisely what the user asks for, without additional features or complexity.  
- the fewer lines of code, the better.  
  
# RESTAURANT METRICS  
- this is a simple restaurant operation tool  
- focus on: table turnover, order accuracy, payment processing speed  
- every decision should improve restaurant efficiency  
  
# QUICK AND DIRTY PROTOTYPE  
- this is a very important concept you must understand  
- when adding new features, always start by creating the "quick and dirty prototype" first  
- this is the 80/20 approach taken to its zenith  
  
# HELP THE USER LEARN  
- when coding, always explain what you are doing and why  
- your job is to help the user learn & upskill himself, above all  
- assume the user is an intelligent, tech savvy person -- but do not assume he knows the details  
- explain everything clearly, simply, in easy-to-understand language. write in short sentences.  
  
# RESTRICTIONS  
- NEVER push to github unless the User explicitly tells you to  
- DO NOT run build commands (there are none for this static app)  
- Do what has been asked; nothing more, nothing less  
  
# ACTIVE CONTRIBUTORS  
- **User (Human)**: Restaurant owner/manager, directs the project, makes business decisions  
- **Human Developers**: Other devs working on this project  
- **AI Agents**: Help with code improvements, bug fixes, and feature additions  
  
# FILE LENGTH  
- we must keep all files under 300 LOC  
- files must be modular & single-purpose  
- current main files are within reasonable limits  
  
# READING FILES  
- always read the file in full, do not be lazy  
- before making any code changes, start by finding & reading ALL of the relevant files  
- never make changes without reading the entire file  
  
# EGO  
- do not make assumption. do not jump to conclusions.  
- you are just a Large Language Model, you are very limited.  
- always consider multiple different approaches, just like a Senior Developer would  
  
# CUSTOM CODE  
- this app uses minimal external dependencies (only Tailwind CSS CDN)  
- prefer vanilla JavaScript over frameworks for this simple use case  
- keep the PWA lightweight and fast-loading  
  
# WRITING STYLE  
- each long sentence should be followed by two newline characters  
- avoid long bullet lists  
- write in natural, plain English. be conversational.  
- avoid using overly complex language, and super long sentences  
- use simple & easy-to-understand language. be concise.  
  
# DATA CHANGES  
- all data is stored in localStorage  
- be careful with data migrations and backward compatibility  
- always test localStorage operations thoroughly  
  
# OUTPUT STYLE  
- write in complete, clear sentences. like a Senior Developer when talking to a junior engineer  
- always provide enough context for the user to understand -- in a simple & short way  
- make sure to clearly explain your assumptions, and your conclusions
