import { createAsyncThunk } from '@reduxjs/toolkit';

export const fetchCounter = createAsyncThunk<number, void>(
   'counter/fetchCounter',
   async (_, { rejectWithValue }) => {
      try {
         const response = await fetch('https://api.example.com/counter');
         if (!response.ok) {
            throw new Error('Failed to fetch data');
         }
         const data = (await response.json()) as { count: number };
         return data.count;
      } catch (error) {
         if (error instanceof Error) {
            return rejectWithValue(error.message);
         }
         return rejectWithValue('Failed to fetch data');
      }
   }
);