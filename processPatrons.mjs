import fs from 'node:fs';
import fetch from 'node-fetch';
import {env} from './env.mjs';

const requiredPaymentStatus = 'Paid';
const qualifyingTiers = ['BEHIND THE SCREENS', 'HIGH ROLLER'];
const campaignId = 1969288;
const baseUrl = 'https://www.patreon.com';

const qualifyingStructures = [
    {
        name: 'diceDrop',
        startDate: new Date('2024-03-01'),
        cutOffDate: new Date('2023-03-01'),
        endDate: new Date('2024-04-30'),
        qualifyingMembers: [],
        annualMembers: [],
    },
    {
        name: 'hoodieDrop',
        startDate: new Date('2024-05-01'),
        cutOffDate: new Date('2023-05-01'),
        endDate: new Date('2024-07-30'),
        qualifyingMembers: [],
        annualMembers: [],
    }
];
const options = {
    headers: {
        'Authorization': `Bearer ${env.accessToken}`,
    },
    method: 'GET'
};

let allMembers = [];
let currentUrl = `${baseUrl}/api/oauth2/v2/campaigns/${campaignId}/members?include=address,pledge_history,currently_entitled_tiers&fields%5Bmember%5D=full_name,lifetime_support_cents,email,last_charge_date,next_charge_date,pledge_cadence&fields%5Baddress%5D=addressee,city,line_1,line_2,postal_code,state,country&fields%5Bpledge-event%5D=date,payment_status,tier_title,amount_cents&fields%5Btier%5D=title`;

const formatAddress = (address) => address ? `${address.line_1} ${address.line_2}, ${address.city} ${address.state} ${address.country} ${address.postal_code}` : 'no address provided';

while(currentUrl) {
    const response = await fetch(currentUrl, options);
    const responseJson = await response.json();
    const members = responseJson.data;
    const {included} = responseJson;

    const pledgeEvents = included.filter((includedObjects) => includedObjects.type === 'pledge-event');

    qualifyingStructures.forEach(({name, startDate, endDate, qualifyingMembers, annualMembers, cutOffDate}) => {
        const paidEvents = pledgeEvents.filter(({attributes}) => attributes.payment_status === requiredPaymentStatus || attributes.payment_status === null);
        const correctTier = paidEvents.filter(({attributes}) => qualifyingTiers.includes(attributes.tier_title));
        const pledgeEventsInTheCorrectTime = correctTier.filter(({attributes}) => new Date(attributes.date) > startDate && new Date(attributes.date) < endDate);

        pledgeEventsInTheCorrectTime.forEach((pledgeEvent) => {
            const matchingMember = members.find((member) => {
                const pledgeData = member.relationships.pledge_history.data;

                return pledgeData.find((record) => record.id === pledgeEvent.id)
            });
            const {email, full_name} = matchingMember.attributes;
            const address = null;

            const existingRecord = qualifyingMembers.find((qualifyingMember) => qualifyingMember.id === matchingMember.id);

            if (existingRecord) {
                console.log(`Existing Qualifier\t for merch ${name}:\t ${full_name} and email ${email} at address ${formatAddress(address)}`);
                existingRecord.qualifyingPledges.push(pledgeEvent);
                existingRecord.totalInTimePeriod += pledgeEvent.attributes.amount_cents / 100
            } else {
                console.log(`New Qualifier\t\t for merch ${name}:\t ${full_name} and email ${email} at address ${formatAddress(address)}`);
                qualifyingMembers.push({
                    id: matchingMember.id,
                    fullName: full_name,
                    email: email,
                    address,
                    qualifyingPledges: [pledgeEvent],
                    totalInTimePeriod: pledgeEvent.attributes.amount_cents / 100
                });
            }
        });

        //-------------------------------------ANNUAL----------------------
        const potentialAnnualMembers = members.filter((member) => member.attributes.pledge_cadence === 12);

        potentialAnnualMembers.forEach((member) => {
            const memberPledgeIds = member.relationships.pledge_history.data.map((pledgeEvent) => pledgeEvent.id);
            const matchingPledges = correctTier.filter((pledgeEvent) => memberPledgeIds.includes(pledgeEvent.id));

            if(matchingPledges.length < 1){
                return
            }

            const orderedPledges = matchingPledges.sort((a,b) => Date(b.attributes.date) - new Date(a.attributes.date));
            const mostRecentPledge = orderedPledges[0];
            const {email, full_name} = member.attributes;
            const address = null;
            const subscribeDate = new Date(mostRecentPledge.attributes.date);

            if(subscribeDate > cutOffDate) {
                console.log(`New Annual Qualifier\t\t for merch ${name}:\t ${full_name} and email ${email} at address ${formatAddress(address)} \t\t at ${subscribeDate}`);
                annualMembers.push({
                    id: member.id,
                    fullName: full_name,
                    email: email,
                    address,
                    qualifyingPledges: [mostRecentPledge],
                    totalInTimePeriod: mostRecentPledge.attributes.amount_cents / 100
                });
            }
        });
    });

    allMembers = [
        ...allMembers,
        ...members
    ];


    console.log(`Total users: ${responseJson.meta.pagination.total}, Number Done: ${allMembers.length}, nextLink: ${responseJson.links?.next}`);

    if(responseJson.links?.next) {
        currentUrl = responseJson.links?.next;
    } else {
        currentUrl = null;
    }
}

// need address, sanitize inputs, crosscheck list for historical data
let finalOutput = 'id,name,email,address,pledgeDate,pledgeAmount,tier,type,merchDropName\n';
qualifyingStructures.forEach(({name, qualifyingMembers, annualMembers}) => {
    console.log(`merch drop ${name}, had ${qualifyingMembers.length + annualMembers.length} qualifiers with ${qualifyingMembers.length} monthly and ${annualMembers.length} yearly`);

    qualifyingMembers.forEach(({id, fullName, email, address, qualifyingPledges, totalInTimePeriod}) => {
        const pledgeAttributes = qualifyingPledges[0].attributes;
        finalOutput = `${finalOutput}${id},${fullName},${email},${address},${pledgeAttributes.date},${totalInTimePeriod},${pledgeAttributes.tier_title},monthly,${name}\n`
    });

    annualMembers.forEach(({id, fullName, email, address, qualifyingPledges, totalInTimePeriod}) => {
        const pledgeAttributes = qualifyingPledges[0].attributes;
        finalOutput = `${finalOutput}${id},${fullName},${email},${address},${pledgeAttributes.date},${totalInTimePeriod},${pledgeAttributes.tier_title},yearly,${name}\n`
    });
});

fs.writeFileSync("qualify.csv", finalOutput);
