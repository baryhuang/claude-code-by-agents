export interface PredefinedAgent {
  // Core Identity
  id: string;
  name: string;
  description: string;
  
  // Specialization & Capabilities
  specialization: string;
  capabilities: string[];
  category: AgentCategory;
  
  // Technical Configuration
  workingDirectory: string;
  defaultApiEndpoint: string;
  isOrchestrator: boolean;
  
  // UI/UX Properties
  color: string;
  icon: string;
  
  // Metadata for Library
  tags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  prerequisites?: string[];
  exampleTasks: string[];
  
  // Documentation
  setupInstructions?: string;
  usageNotes?: string;
}

export enum AgentCategory {
  DEVELOPMENT = "development",
  ANALYSIS = "analysis", 
  TESTING = "testing",
  DEVOPS = "devops",
  DOCUMENTATION = "documentation",
  ORCHESTRATION = "orchestration",
  SPECIALIZED = "specialized"
}

export const PREDEFINED_AGENTS_LIBRARY: PredefinedAgent[] = [
  // Orchestration Agents
  {
    id: "orchestrator-claude",
    name: "Claude Code Orchestrator",
    description: "Intelligent orchestrator that coordinates multi-agent workflows and manages complex projects",
    specialization: "Multi-agent coordination and project management",
    capabilities: ["Task planning", "Agent coordination", "Workflow orchestration", "Project management"],
    category: AgentCategory.ORCHESTRATION,
    workingDirectory: "/tmp/orchestrator",
    defaultApiEndpoint: "http://agents.claudecode.run",
    isOrchestrator: true,
    color: "bg-gradient-to-r from-blue-500 to-purple-500",
    icon: "🎭",
    tags: ["orchestration", "coordination", "planning", "management"],
    difficulty: "intermediate",
    exampleTasks: [
      "Plan a multi-component feature across frontend and backend",
      "Coordinate code reviews between multiple agents",
      "Orchestrate deployment pipeline tasks"
    ],
    setupInstructions: "This agent requires access to all project contexts to effectively coordinate tasks.",
    usageNotes: "Use @orchestrator to delegate complex multi-step tasks that require coordination."
  },

  // Development Agents
  {
    id: "fullstack-developer",
    name: "Full-Stack Developer",
    description: "Experienced full-stack developer specializing in modern web applications with React and Node.js",
    specialization: "Full-stack web development",
    capabilities: ["React", "TypeScript", "Node.js", "Express", "REST APIs", "Database design", "Authentication"],
    category: AgentCategory.DEVELOPMENT,
    workingDirectory: "/tmp/fullstack",
    defaultApiEndpoint: "http://agents.claudecode.run",
    isOrchestrator: false,
    color: "bg-gradient-to-r from-green-500 to-blue-500",
    icon: "⚡",
    tags: ["react", "nodejs", "typescript", "fullstack", "web", "api"],
    difficulty: "intermediate",
    exampleTasks: [
      "Build a complete user authentication system",
      "Create REST API endpoints with database integration",
      "Implement responsive React components with TypeScript"
    ],
    prerequisites: ["Node.js", "npm/yarn", "Database (PostgreSQL/MongoDB)"],
    setupInstructions: "Ensure Node.js and your preferred database are installed and configured.",
    usageNotes: "Great for end-to-end feature development spanning frontend and backend."
  },

  {
    id: "frontend-react-expert",
    name: "React Frontend Expert",
    description: "Frontend specialist focused on React, Next.js, and modern UI/UX development",
    specialization: "Frontend development with React ecosystem",
    capabilities: ["React", "Next.js", "TypeScript", "Tailwind CSS", "State management", "Testing", "Performance optimization"],
    category: AgentCategory.DEVELOPMENT,
    workingDirectory: "/tmp/frontend",
    defaultApiEndpoint: "http://agents.claudecode.run",
    isOrchestrator: false,
    color: "bg-gradient-to-r from-cyan-500 to-blue-500",
    icon: "⚛️",
    tags: ["react", "nextjs", "frontend", "ui", "typescript", "tailwind"],
    difficulty: "intermediate",
    exampleTasks: [
      "Build responsive React components with TypeScript",
      "Implement complex state management with Context/Redux",
      "Optimize React app performance and bundle size"
    ],
    prerequisites: ["Node.js", "React knowledge"],
    setupInstructions: "Works best with React 18+ and TypeScript projects.",
    usageNotes: "Excellent for UI components, user experience, and frontend architecture."
  },

  {
    id: "backend-api-specialist",
    name: "Backend API Specialist",
    description: "Backend expert specializing in scalable APIs, databases, and server-side architecture",
    specialization: "Backend API development and architecture",
    capabilities: ["Node.js", "Python", "REST APIs", "GraphQL", "Database design", "Authentication", "Microservices"],
    category: AgentCategory.DEVELOPMENT,
    workingDirectory: "/tmp/backend",
    defaultApiEndpoint: "http://agents.claudecode.run",
    isOrchestrator: false,
    color: "bg-gradient-to-r from-orange-500 to-red-500",
    icon: "🔧",
    tags: ["backend", "api", "database", "nodejs", "python", "microservices"],
    difficulty: "intermediate",
    exampleTasks: [
      "Design and implement REST API endpoints",
      "Set up database schemas and migrations",
      "Implement authentication and authorization systems"
    ],
    prerequisites: ["Node.js or Python", "Database system"],
    setupInstructions: "Requires backend runtime environment and database access.",
    usageNotes: "Best for server-side logic, data modeling, and API development."
  },

  // Analysis Agents
  {
    id: "code-reviewer",
    name: "Code Review Expert",
    description: "Code quality specialist focusing on security, performance, and best practices",
    specialization: "Code review and quality assurance",
    capabilities: ["Static analysis", "Security review", "Performance analysis", "Best practices", "Code refactoring"],
    category: AgentCategory.ANALYSIS,
    workingDirectory: "/tmp/review",
    defaultApiEndpoint: "http://agents.claudecode.run",
    isOrchestrator: false,
    color: "bg-gradient-to-r from-purple-500 to-pink-500",
    icon: "🔍",
    tags: ["review", "security", "performance", "quality", "refactoring"],
    difficulty: "advanced",
    exampleTasks: [
      "Review code for security vulnerabilities",
      "Analyze performance bottlenecks in applications",
      "Suggest refactoring improvements for code quality"
    ],
    setupInstructions: "Works with any codebase. Best with access to static analysis tools.",
    usageNotes: "Use for thorough code reviews and identifying improvement opportunities."
  },

  {
    id: "performance-optimizer",
    name: "Performance Optimizer",
    description: "Performance specialist focused on application optimization, profiling, and benchmarking",
    specialization: "Performance analysis and optimization",
    capabilities: ["Performance profiling", "Benchmarking", "Memory optimization", "Database optimization", "Frontend performance"],
    category: AgentCategory.ANALYSIS,
    workingDirectory: "/tmp/performance",
    defaultApiEndpoint: "http://agents.claudecode.run",
    isOrchestrator: false,
    color: "bg-gradient-to-r from-yellow-500 to-orange-500",
    icon: "⚡",
    tags: ["performance", "optimization", "profiling", "benchmarking", "speed"],
    difficulty: "advanced",
    exampleTasks: [
      "Profile application performance bottlenecks",
      "Optimize database queries and indexing",
      "Improve frontend loading times and user experience"
    ],
    prerequisites: ["Profiling tools", "Performance monitoring setup"],
    setupInstructions: "Best with access to profiling tools and performance monitoring.",
    usageNotes: "Excellent for optimizing slow applications and improving scalability."
  },

  // Testing Agents
  {
    id: "test-automation-expert",
    name: "Test Automation Expert",
    description: "Testing specialist covering unit tests, integration tests, and end-to-end automation",
    specialization: "Comprehensive test automation",
    capabilities: ["Unit testing", "Integration testing", "E2E testing", "Test frameworks", "CI/CD testing", "Mock/stub creation"],
    category: AgentCategory.TESTING,
    workingDirectory: "/tmp/testing",
    defaultApiEndpoint: "http://agents.claudecode.run",
    isOrchestrator: false,
    color: "bg-gradient-to-r from-indigo-500 to-purple-500",
    icon: "🧪",
    tags: ["testing", "automation", "unit-tests", "e2e", "ci-cd", "quality"],
    difficulty: "intermediate",
    exampleTasks: [
      "Create comprehensive unit test suites",
      "Set up integration tests for API endpoints",
      "Implement end-to-end testing with Playwright/Cypress"
    ],
    prerequisites: ["Testing framework (Jest, Vitest, etc.)", "E2E tools (Playwright, Cypress)"],
    setupInstructions: "Requires testing frameworks and potentially browser automation tools.",
    usageNotes: "Great for ensuring code quality and preventing regressions."
  },

  // DevOps Agents
  {
    id: "devops-automation",
    name: "DevOps Automation Specialist",
    description: "DevOps expert specializing in CI/CD, containerization, and infrastructure automation",
    specialization: "DevOps and infrastructure automation",
    capabilities: ["Docker", "Kubernetes", "CI/CD pipelines", "Infrastructure as Code", "Monitoring", "AWS/GCP/Azure"],
    category: AgentCategory.DEVOPS,
    workingDirectory: "/tmp/devops",
    defaultApiEndpoint: "http://agents.claudecode.run",
    isOrchestrator: false,
    color: "bg-gradient-to-r from-gray-600 to-gray-800",
    icon: "🚀",
    tags: ["devops", "docker", "kubernetes", "cicd", "infrastructure", "cloud"],
    difficulty: "advanced",
    exampleTasks: [
      "Set up CI/CD pipelines with GitHub Actions",
      "Create Docker containers and Kubernetes deployments",
      "Implement infrastructure monitoring and alerting"
    ],
    prerequisites: ["Docker", "Cloud provider access", "CI/CD platform"],
    setupInstructions: "Requires access to cloud providers and container orchestration platforms.",
    usageNotes: "Best for deployment automation and infrastructure management."
  },

  // Documentation Agents
  {
    id: "technical-writer",
    name: "Technical Documentation Writer",
    description: "Documentation specialist creating clear, comprehensive technical documentation",
    specialization: "Technical writing and documentation",
    capabilities: ["API documentation", "User guides", "Architecture docs", "README files", "Code comments", "Tutorial creation"],
    category: AgentCategory.DOCUMENTATION,
    workingDirectory: "/tmp/docs",
    defaultApiEndpoint: "http://agents.claudecode.run",
    isOrchestrator: false,
    color: "bg-gradient-to-r from-emerald-500 to-teal-500",
    icon: "📝",
    tags: ["documentation", "writing", "api-docs", "guides", "tutorials"],
    difficulty: "beginner",
    exampleTasks: [
      "Create comprehensive API documentation",
      "Write user guides and tutorials",
      "Document system architecture and design decisions"
    ],
    setupInstructions: "Works with any codebase. Best with access to documentation tools.",
    usageNotes: "Excellent for creating clear, maintainable documentation."
  },

  // Specialized Agents
  {
    id: "security-auditor",
    name: "Security Auditor",
    description: "Cybersecurity specialist focused on vulnerability assessment and secure coding practices",
    specialization: "Security analysis and vulnerability assessment",
    capabilities: ["Security auditing", "Vulnerability scanning", "Secure coding", "Compliance checking", "Threat modeling"],
    category: AgentCategory.SPECIALIZED,
    workingDirectory: "/tmp/security",
    defaultApiEndpoint: "http://agents.claudecode.run",
    isOrchestrator: false,
    color: "bg-gradient-to-r from-red-600 to-red-800",
    icon: "🔒",
    tags: ["security", "vulnerability", "audit", "compliance", "threats"],
    difficulty: "advanced",
    exampleTasks: [
      "Audit codebase for security vulnerabilities",
      "Review authentication and authorization implementations",
      "Perform threat modeling for new features"
    ],
    prerequisites: ["Security scanning tools", "Understanding of threat landscape"],
    setupInstructions: "Best with access to security scanning tools and compliance frameworks.",
    usageNotes: "Critical for maintaining application security and compliance."
  },

  {
    id: "data-analyst",
    name: "Data Analyst",
    description: "Data specialist focused on analysis, visualization, and insights from application data",
    specialization: "Data analysis and business intelligence",
    capabilities: ["Data analysis", "SQL queries", "Data visualization", "Statistical analysis", "Business intelligence"],
    category: AgentCategory.SPECIALIZED,
    workingDirectory: "/tmp/data",
    defaultApiEndpoint: "http://agents.claudecode.run",
    isOrchestrator: false,
    color: "bg-gradient-to-r from-blue-600 to-indigo-600",
    icon: "📊",
    tags: ["data", "analytics", "sql", "visualization", "insights"],
    difficulty: "intermediate",
    exampleTasks: [
      "Analyze user behavior data and create insights",
      "Design and optimize database queries",
      "Create data visualizations and dashboards"
    ],
    prerequisites: ["Database access", "Data visualization tools"],
    setupInstructions: "Requires access to databases and data analysis tools.",
    usageNotes: "Great for understanding user behavior and business metrics."
  }
];

// Utility functions for predefined agents
export const getAgentsByCategory = (category: AgentCategory): PredefinedAgent[] => {
  return PREDEFINED_AGENTS_LIBRARY.filter(agent => agent.category === category);
};

export const getAgentsByDifficulty = (difficulty: "beginner" | "intermediate" | "advanced"): PredefinedAgent[] => {
  return PREDEFINED_AGENTS_LIBRARY.filter(agent => agent.difficulty === difficulty);
};

export const searchAgents = (query: string, tags?: string[]): PredefinedAgent[] => {
  const queryLower = query.toLowerCase();
  
  return PREDEFINED_AGENTS_LIBRARY.filter(agent => {
    const matchesQuery = 
      agent.name.toLowerCase().includes(queryLower) ||
      agent.description.toLowerCase().includes(queryLower) ||
      agent.specialization.toLowerCase().includes(queryLower) ||
      agent.capabilities.some(cap => cap.toLowerCase().includes(queryLower)) ||
      agent.tags.some(tag => tag.toLowerCase().includes(queryLower));
    
    const matchesTags = !tags || tags.length === 0 || 
      tags.some(tag => agent.tags.includes(tag.toLowerCase()));
    
    return matchesQuery && matchesTags;
  });
};

export const getPopularTags = (): string[] => {
  const tagCounts = new Map<string, number>();
  
  PREDEFINED_AGENTS_LIBRARY.forEach(agent => {
    agent.tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  
  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .slice(0, 20); // Top 20 most popular tags
};

export const convertPredefinedToAgent = (predefined: PredefinedAgent, customEndpoint?: string): {
  id: string;
  name: string;
  workingDirectory: string;
  color: string;
  description: string;
  apiEndpoint: string;
  isOrchestrator: boolean;
} => {
  return {
    id: predefined.id,
    name: predefined.name,
    workingDirectory: predefined.workingDirectory,
    color: predefined.color,
    description: predefined.description,
    apiEndpoint: customEndpoint || predefined.defaultApiEndpoint,
    isOrchestrator: predefined.isOrchestrator,
  };
};