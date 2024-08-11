

<template>
  <v-container>

    <div class="text-h5">Upload CSV</div>

    <!--Set up the file upload element-->
    <!--Contain the following elements on the same row-->
    <!--Client select dropdown-->
    <v-row>
      <v-col>
        <v-combobox v-model="selectedClient" item-title="name" :items="clients" label="Select Client"
          @update:model-value="getCampaigns" @new-item="selectedClient">
        </v-combobox>
      </v-col>
      <v-col>
        <!--Input field for campaign-->
        <v-combobox label="Campaigns" v-model="campaign" item-title="name" :items="filteredCampaigns"
          @update:search="updateCampaigns" @new-item="addCampaign"></v-combobox>
      </v-col>
      <v-col>
        <v-file-input v-model="file" label="Upload CSV" accept=".csv"></v-file-input>
      </v-col>
    <v-col>
  <v-btn @click="uploadFile">Upload</v-btn>
  <!-- Use v-progress-linear to display the progress bar with text -->
  <v-progress-linear v-if="showProgressBar" :value="uploadProgress" height="10">
    {{ uploadProgress }}%
  </v-progress-linear>
  <p v-if="totalCount > 0">{{ progressCount.progress }} / {{ totalCount }} uploaded</p>
</v-col>

    </v-row>

  </v-container>
</template>


<script setup>
import axios from 'axios';
import { ref, defineProps, watch, computed } from 'vue';
import io from 'socket.io-client';

const props = defineProps(['clients']);
const clients = ref(props.clients);
const selectedClient = ref(null);
const campaign = ref(null);
const campaigns = ref([]);
const search = ref(null);
const showProgressBar = ref(false); // Whether to show the progress bar
const uploadProgress = ref(0); // The current upload progress (percentage)
const totalFileSize = ref(0); // Total file size in bytes
const uploadedBytes = ref(0);

// Create socket connection
const socket = io("http://localhost:3000");

// Reactive ref to store totalCount
const totalCount = ref(0);
const progressCount = ref(0);

// Socket listener
socket.on("on-update-progress", (newCount) => {
  progressCount.value = newCount;
  //console.log(`Got on-update-progress event ${totalCount.value}`);
});

socket.on("on-total", (newCount) => {
  totalCount.value = newCount.total;
  //console.log(`Got on-total event ${totalCount.value}`);
});


watch(() => props.clients, (newVal) => {
  clients.value = newVal;
});

//watch selectedClient
watch(() => selectedClient.value, () => {
  //console.log('Selected client changed');
  getCampaigns();
});

let campaignName;

watch(() => campaign.value, () => {
  campaignName = campaign.value;
  //console.log('Selected campaign changed');
  //console.log('campaign.value:' + campaign.value);
  //console.log('campaign.value.name:' + campaign.value.name);

  //console.log('campaign object:' + JSON.stringify(campaign.value));

  //console.log('campaignName:' + campaignName);
});

const filteredCampaigns = computed(() => {
  if (selectedClient.value && selectedClient.value.campaigns) {
    //console.log('Filtered campaigns in UploadCSV');
    //console.log(selectedClient.value.campaigns);
    return selectedClient.value.campaigns;
  }

  return [];
});

const addCampaign = (newCampaignName) => {
  // Assuming campaigns is an array of campaign objects with a 'name' property
  campaigns.value.push({ name: newCampaignName });
};


const file = ref(null);

const uploadFile = async () => {
  // Reset progress before starting upload
  // check if all fields are filled out
    uploadProgress.value = 0;
      uploadedBytes.value = 0;
  showProgressBar.value = true;


  if (!selectedClient.value || !campaign.value || !file.value) {
    //console.log('Please fill out all fields');
        showProgressBar.value = false; // Hide the progress bar on error
    return;
  }

  const formData = new FormData();

  formData.append('file', file.value[0]);
  formData.append('client', selectedClient.value.name || selectedClient.value);
  formData.append('campaign', campaignName);


try {
    const res = await axios.post('http://localhost:3000/upload', formData, {
      onUploadProgress: (progressEvent) => {
        // Calculate the upload progress percentage
                uploadedBytes.value = progressEvent.loaded;
        const percentage = (progressEvent.loaded / progressEvent.total) * 100;
        uploadProgress.value = 50;
      },
    });

    //console.log(res.data);
    // Reset progress after successful upload
    uploadProgress.value = 50; // Set progress to 100% on success
      } catch (err) {
    console.error(err);
    // Reset progress on error
    uploadProgress.value = 0;
  } finally {
    showProgressBar.value = false; // Hide the progress bar after upload completion
  }
};

const updateCampaigns = async (newSearch) => {
  // Update campaigns array based on new search string
  search.value = newSearch;
  campaignName = search.value;
  //console.log(search.value);
}

const getCampaigns = async () => {
  // Get campaigns for selected client
  try {
    const res = await axios.get(`http://localhost:3000/clients/${selectedClient.value.name}/campaigns`);
    campaigns.value = res.data.campaigns;
    //console.log(campaigns.value);
  } catch (err) {
    console.error(err);
  }
}


</script>
