import { supabase } from './supabaseClient';

export const ContactService = {
    /**
     * Fetch all contacts from Supabase
     * Returns a map: { [clientName]: { contact_name, contact_email, notes } }
     */
    async getAllContacts() {
        const { data, error } = await supabase
            .from('client_contacts')
            .select('*');

        if (error) {
            console.error('Error fetching contacts:', error);
            return {};
        }

        // Convert array to efficient lookup map
        const contactMap = {};
        data.forEach(item => {
            contactMap[item.client_name] = item;
        });
        return contactMap;
    },

    /**
     * Upsert (Insert or Update) a contact for a client
     */
    async saveContact(clientName, contactData) {
        const { data, error } = await supabase
            .from('client_contacts')
            .upsert({
                client_name: clientName,
                contact_name: contactData.name,
                contact_email: contactData.email,
                notes: contactData.notes
            }, { onConflict: 'client_name' })
            .select();

        if (error) throw error;
        return data[0];
    },
    /**
     * Trigger the Edge Function to send an email
     */
    async sendCollectionEmail(email, clientName, debtDetails) {
        const { data, error } = await supabase.functions.invoke('send-collection-email', {
            body: { email, clientName, debtDetails }
        });

        // Handle network/invoke errors
        if (error) throw error;

        // Handle application-level errors (returned as 200 OK with success: false)
        if (data && data.success === false) {
            throw new Error(data.error || 'Error desconocido del servidor');
        }

        return data;
    }
};
