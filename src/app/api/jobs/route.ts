/*
  This API route fetches all the job postings listed in salesforce org.
*/

import { getSalesforceAccessV2Token } from "@/app/lib/salesforceAuthV2";
import { Job } from "@/app/types";
import axios from "axios";
import { NextResponse } from "next/server";

const SF_DOMAIN = process.env.SF_DOMAIN ?? "";
const SF_GET_ALL_JOB_POSTINGS =
  process.env.Get_All_Job_Postings_Listed_FLOW_NAME ?? "";

export async function GET() {
  try {
    // Get Salesforce access token for API requests
    const response = await getSalesforceAccessV2Token();
    const { access_token } = await response.json();

    try {
      const getAllJobPostings = `${SF_DOMAIN}/services/data/v64.0/actions/custom/flow/${SF_GET_ALL_JOB_POSTINGS}`;

      const flowData = {
        inputs: [
          {
            fetchData: true,
          },
        ],
      };
      interface FlowResponse {
        actionName: string;
        errors: Array<{
          statusCode: string;
          message: string;
          fields: string[];
        }> | null;
        invocationId: string | null;
        isSuccess: boolean;
        outcome: string | null;
        outputValues: {
          jobPostingsRecord?: Array<{
            attributes: {
              type: string | null;
              url: string | null;
            };
            Id: string | null;
            CreatedDate: string | null;
            Description__c: string | null;
            Experience__c: number | null;
            Job_Name__c: string | null;
            Company__c: string | null;
            location__c: string | null;
            Maximum_Salary__c: number | null;
            Minimum_Salary__c: number | null;
            Name: string | null;
            openings__c: number | null;
            Skills__c: string | null;
            Position__c: string | null;
            Type__c: string | null;
            Work_Mode__c: string | null;
          }> | null;
          Flow__InterviewStatus?: string | null;
          [key: string]: unknown;
        };
        sortOrder: number;
        version: number;
      }
      
      const flowResponse = (
        await axios.post<FlowResponse[]>(getAllJobPostings, flowData, {
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
        })
      ).data;

      if (!flowResponse[0].isSuccess) {
        // If the flow execution fails, return an error response
        return NextResponse.json(
          { message: "Flow execution failed", sessionId: "" },
          { status: 500 }
        );
      }

      if (
        !flowResponse[0].outputValues.jobPostingsRecord
      ) {
        // If candidate or job ID is not found, return an error response
        return NextResponse.json(
          { message: "Unable to Get Job Postings", sessionId: "" },
          { status: 500 }
        );
      }

      if (flowResponse[0].outputValues.jobPostingsRecord &&
        flowResponse[0].outputValues.jobPostingsRecord.length <=
          0
      ) {
        // If the check flow execution fails, return an error response
        return NextResponse.json(
          {
            message: "No Job Listed Currently",
            sessionId: "",
          },
          { status: 404 }
        );
      }

      const jobs:Job[] = [];

      flowResponse[0].outputValues.jobPostingsRecord.map((job) => {

        const jobData = {
          id: job.Id!,
          title: job.Job_Name__c!,
          company: job.Company__c!,
          location: job.location__c!,
          description: job.Description__c!,
          type: job.Type__c!,
          postDate: job.CreatedDate!,
          skills: job.Skills__c!,
          experience: job.Experience__c!,
          workMode: job.Work_Mode__c!,
          openings: job.openings__c!,
          salary_min: job.Minimum_Salary__c!,
          salary_max: job.Maximum_Salary__c!
        }
        
        jobs.push(jobData);
      });

      return NextResponse.json(jobs,{status:200});

    } catch (error) {
      // Handle errors in calling the flow
      console.log("Error calling flow to get job data: " + error);
      return NextResponse.json(
        {
          message: "Flow execution failed",
          sessionId: "",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    // Handle errors in getting the access token
    console.log("Error getting access token: " + error);
    return NextResponse.json(
      { message: "failed", access_token: "" },
      { status: 500 }
    );
  }
}
