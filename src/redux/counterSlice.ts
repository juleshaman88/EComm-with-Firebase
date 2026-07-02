import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { fetchCounter } from './asyncActions';

interface CounterState {
   count: number;
   loading: boolean;
   error: string | null;
}

const initialState: CounterState = {
   count: 0,
   loading: false,
   error: null,
};

const counterSlice = createSlice({
   name: 'counter',
   initialState,
   reducers: {
      increment: (state) => {
         state.count += 1;
      },
      decrement: (state) => {
         state.count -= 1;
      },
       incrementByAmount: (state, action: PayloadAction<number>) => {
         state.count += action.payload;
      },
   },
   extraReducers: (builder) => {
      builder
         .addCase(fetchCounter.pending, (state) => {
            state.loading = true;
            state.error = null;
         })
         .addCase(fetchCounter.fulfilled, (state, action) => {
            state.loading = false;
            state.count = action.payload;
         })
         .addCase(fetchCounter.rejected, (state, action) => {
            state.loading = false;
            state.error = action.payload as string;
         });
   },
});

export const { increment, decrement, incrementByAmount } = counterSlice.actions;
export default counterSlice.reducer;
