

<template>
  <v-container>
    <div class="text-h5">Enrichment Data</div>
    <!--Set up the Enrichment Data element, including Total in DB for specific client-->
    <!-- Select the client from dropdown-->
    <v-row>
      <v-col>
        <v-select v-model:model-value="selectedClient" item-title="name" :items="clients"
          label="Select Client"
          @update:model-value="getCampaigns"></v-select>
      </v-col>
      <v-col>
        <v-select v-if="selectedClient" label="Campaigns" 
        item-title="name" :items="filteredCampaigns"
         v-model="selectedCampaign"></v-select>
      </v-col>
    </v-row>

    <!-- Statistics Header and Delineated Area -->
    <v-row v-if="selectedClient && stats">
      <v-col cols="12">
        <div class="text-h6 my-4">Campaign Statistics</div>
        <v-row>
          <v-col v-for="(value, key, index) in stats" :key="index" cols="12" md="4">
            <v-card class="pa-4" outlined elevation="2">
              <div class="text-subtitle-1">{{ key }}</div>
              <div class="text-h4">{{ value }}</div>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <v-select v-if="selectedClient && selectedCampaign" label="Prompts" item-title="name" :items="prompts"
          v-model="selectedPrompt"></v-select>
        <v-btn v-if="selectedClient && stats" @click="runEnrichment">Run enrichment</v-btn>
        <v-btn v-if="selectedClient && stats" @click="downloadCSV">Download CSV</v-btn>
      </v-col>
    </v-row>

  </v-container>
</template>


<script setup>
//Get props from parent
import axios from 'axios';
import { defineProps, ref, computed, watch } from 'vue';
import io from 'socket.io-client';
const socket = io("http://localhost:3000");

const props = defineProps(['clients', 'prompts']);
const clients = ref(props.clients);
const prompts = ref(props.prompts);
//console.log('EnrichmentData.vue');
//console.log(clients.value);
//console.log(prompts.value);

const selectedClient = ref(null);
const selectedCampaign = ref(null);
const selectedPrompt = ref(null);
const campaigns = ref([]);
const stats = ref(null);

const filteredCampaigns = computed(() => {
  //console.log('Computed campaigns');

  return campaigns.value;
});


const runEnrichment = async () => {
  // Run enrichment for selected client
  //console.log('runEnrichment');
  try {
    //console.log(selectedClient.value);
    //console.log(selectedCampaign.value);
    const res = await axios.post(`http://localhost:3000/clients/${selectedClient.value}/${selectedCampaign.value}/enrich`,
    {
      prompt: selectedPrompt.value
    },
    {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    //console.log(res.data);
  } catch (err) {
    console.error(err);
  }
}

const getCampaigns = async () => {
  // Get campaigns for selected client
  //console.log('getCampaigns');
  try {
    //console.log(selectedClient.value);
    const res = await axios.get(`http://localhost:3000/clients/${selectedClient.value}/campaigns`);
    campaigns.value = res.data.campaigns;
    //console.log(campaigns.value);
  } catch (err) {
    console.error(err);
  }
}

const downloadCSV = async () => {
  // Download CSV for selected client
  //console.log('downloadCSV');
  try {
    //console.log(selectedClient.value);
    //console.log(selectedCampaign.value);
    const res = await axios.get(`http://localhost:3000/clients/${selectedClient.value}/${selectedCampaign.value}/download`, {
      responseType: 'blob'
    });

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedClient.value}-${selectedCampaign.value}.csv`);
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);

    //console.log(res.data);
  } catch (err) {
    console.error(err);
  }
}

//set up a watcher on the selected campaign
//watch selectedClient
watch(() => selectedCampaign.value, () => {
  //console.log('Selected campaign changed');
  //console.log(selectedCampaign.value);
  getStats();
});

watch(() => selectedPrompt.value, () => {
  //console.log('Selected prompt changed');
  //console.log(selectedPrompt.value);
});

//listen for events
socket.on("on-db-doc-inserted", () => {
  //console.log("on-db-doc-inserted");
  getStats();
});

const getStats = async () => {
  // Get stats for selected client
  //console.log('getStats');
  try {
    //console.log(selectedClient.value);
    //console.log(selectedCampaign.value);
    //console.log(selectedCampaign);
    if (!selectedCampaign.value) {
      selectedCampaign.value = getSelectedCampaign();
    }
    const res = await axios.get(`http://localhost:3000/clients/${selectedClient.value}/${selectedCampaign.value}/stats`);
    stats.value = res.data.stats;
    //console.log(res.data);
  } catch (err) {
    console.error(err);
  }
}

function getSelectedCampaign() {
  //console.log('getSelectedCampaign');
  //console.log(selectedCampaign.value);
  return selectedCampaign.value;
}



</script>
