<template>
  <v-card>
    <v-layout>
      <!-- <v-system-bar color="deep-purple darken-3"></v-system-bar> -->

      <v-app-bar color="primary" prominent>
        <v-toolbar-title>Lead Gen Wizard - Alpha demo</v-toolbar-title>
      </v-app-bar>
      <v-main>
        <UploadCSV :clients="clients" />
        <EnrichmentData v-if="prompts && clients.length > 0 && prompts.length > 0" :clients="clients" :prompts="prompts" />
      </v-main>
    </v-layout>
  </v-card>
</template>
<script setup>
clients;
prompts;
</script>
<script>
import UploadCSV from './components/UploadCSV.vue';
import EnrichmentData from './components/EnrichmentData.vue';
import axios from 'axios';
import { ref } from 'vue';
import io from 'socket.io-client';

let clients = ref([]);
let prompts = ref([]);

// Use a function to fetch clients
const fetchClients = async () => {
  try {
    const res = await axios.get('http://localhost:3000/clients');
    clients.value = res.data.clients;
    //console.log('Got clients in App.vue');
    //console.log(clients.value);
  } catch (err) {
    console.error(err);
  }
};

const fetchPrompts = async () => {
  try {
    const res = await axios.get('http://localhost:3000/prompts');
    prompts.value = res.data.prompts;
    //console.log('Got prompts in App.vue');
    //console.log(res.data.prompts);
  } catch (err) {
    console.error(err);
  }
};

export default {
  name: 'App',
  components: { UploadCSV, EnrichmentData },
  data() {
    return {
      total: 0,
      progress: 0,
      clients,
      prompts
    };
  },
  mounted() {
    const socket = io('http://localhost:3000');
    socket.on('progress', (data) => {
      this.progress = data.progress;
    });
    socket.on('error', (err) => {
      console.error(err);
    });
    fetchClients();
    fetchPrompts();
  },
}
</script>


