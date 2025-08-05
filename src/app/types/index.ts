export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  type: string;
  postDate: string;
  skills: string;
  experience: number;
  workMode: string;
  openings: number;
  salary_min: number;
  salary_max: number;
}


export interface Application {
  id: string;
  jobId: string;
  candidateId: string;
  name: string;
  email: string;
  mobile: string;
  address: string;
  country: string;
  pinCode: string;
}

export interface CreateApplicationData {
  jobId: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  postalCode: string;
  street: string;
  city: string;
  stateProvince: string;
  country: "India"|"Australia"|"Poland"|"Italy"|"France"|"UK";
}

export type Message = {
  type: "ai" | "user";
  message: string;
  aiStatus?: string;
  isTyping?: boolean;
};

export type TextChunk = {
  chunk: string;
  offset: number;
};

export type StreamingEvent = {
  type: string;
  message: {
    type: string;
    message: string;
  };
  offset: number;
};

export type SalesforceJobRecord = {
  Id: string;
  Name: string;
  Company_Name__r: { // This is a related object
    Name: string;
  };
  Location__c: string;
  Job_Description__c: string;
  Type__c: string;
  Open_Date__c: string; // Dates from JSON are typically strings
  Responsibilities__c: string;
  Skills_Required__c: string;
  Min_Pay__c: number | null; // Can be a number or null
  Max_Pay__c: number | null; // Can be a number or null
  CreatedDate: string;
}